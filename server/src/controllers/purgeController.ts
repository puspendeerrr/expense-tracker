import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendOk } from '../utils/http.js';
import { validated } from '../middleware/validate.js';
import { paiseToRupees } from '../utils/money.js';
import { ERROR_CODES, badRequest } from '../utils/errors.js';
import * as purgeService from '../services/purgeService.js';
import { publishToGroup } from '../realtime/socketServer.js';
import { REALTIME_EVENTS } from '../realtime/events.js';

/**
 * History purge endpoints.
 *
 * Two steps by design. The preview is safe to call freely and is what the confirmation
 * dialog is built from; the execute step re-derives everything server-side and refuses
 * anything the preview would have refused. The client's preview is never trusted as
 * authorisation -- only as a thing to show.
 */

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const purgeFilterShape = {
  groupId: z.string().uuid().optional(),
  from: dateSchema,
  to: dateSchema,
  memberId: z.string().uuid().optional(),
  category: z
    .enum([
      'groceries',
      'food_dining',
      'rent',
      'utilities',
      'entertainment',
      'travel',
      'household',
      'medical',
      'other',
    ])
    .optional(),
  paymentMode: z.enum(['cash', 'upi']).optional(),
  includeActivities: z.boolean().default(true),
};

const orderedRange = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine((data) => (data as { from: string; to: string }).from <= (data as { from: string; to: string }).to, {
    path: ['from'],
    message: '"From" must not be after "to"',
  });

export const purgeFiltersSchema = orderedRange(z.object(purgeFilterShape).strict());

/**
 * Built from the shared shape rather than intersected with the filter schema: the
 * filter schema is `.strict()`, so an intersection would validate `confirmation`
 * against it and reject it as an unknown key.
 */
export const purgeExecuteSchema = orderedRange(
  z
    .object({
      ...purgeFilterShape,
      /**
       * The operator must retype the group's name. A destructive action needs an
       * intentional act, not one more OK button that can be clicked through by habit.
       */
      confirmation: z.string().trim().min(1, 'Type the group name to confirm'),
    })
    .strict(),
);

const presentPreview = (preview: purgeService.PurgePreview) => ({
  from: preview.from,
  to: preview.to,
  expenseCount: preview.expenseCount,
  settlementCount: preview.settlementCount,
  activityCount: preview.activityCount,
  amountPaise: preview.amountPaise,
  amount: paiseToRupees(preview.amountPaise),
  safe: preview.safe,
  blockingDebts: preview.blockingDebts.map((debt) => ({
    ...debt,
    owed: paiseToRupees(debt.owedPaise),
  })),
});

const readFilters = (req: Request, input: z.infer<typeof purgeFiltersSchema>) => ({
  // Always the proven group from the middleware, never the id in the body.
  groupId: req.group!.id,
  from: input.from,
  to: input.to,
  ...(input.memberId ? { memberId: input.memberId } : {}),
  ...(input.category ? { category: input.category } : {}),
  ...(input.paymentMode ? { paymentMode: input.paymentMode } : {}),
  includeActivities: input.includeActivities,
});

export const previewPurge = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, purgeFiltersSchema);
  const preview = await purgeService.previewPurge(readFilters(req, input));
  sendOk(res, presentPreview(preview));
};

export const executePurge = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, purgeExecuteSchema);

  if (input.confirmation.trim() !== req.group!.name.trim()) {
    throw badRequest(
      ERROR_CODES.VALIDATION_ERROR,
      'The confirmation text does not match the group name.',
    );
  }

  const result = await purgeService.executePurge(readFilters(req, input), {
    id: req.user!.id,
    email: req.user!.email,
  });

  publishToGroup({
    event: REALTIME_EVENTS.EXPENSE_DELETED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    message: `${req.user!.fullName} cleared history from ${input.from} to ${input.to}`,
  });

  sendOk(res, { ...result, amount: paiseToRupees(result.amountPaise) });
};

export const listPurgeAudits = async (req: Request, res: Response): Promise<void> => {
  const { rows, total } = await purgeService.listPurgeAudits({
    groupId: req.group!.id,
    limit: 50,
    offset: 0,
  });

  sendOk(res, {
    audits: rows.map((row) => ({
      id: row.id,
      from: row.fromDate,
      to: row.toDate,
      actorEmail: row.actorEmail,
      expensesDeleted: row.expensesDeleted,
      settlementsDeleted: row.settlementsDeleted,
      activitiesDeleted: row.activitiesDeleted,
      amountPaise: row.amountPurgedPaise,
      amount: paiseToRupees(row.amountPurgedPaise),
      createdAt: row.createdAt.toISOString(),
    })),
    total,
  });
};
