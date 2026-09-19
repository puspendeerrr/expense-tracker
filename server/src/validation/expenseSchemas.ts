import { z } from 'zod';
import { rupeesToPaise, percentToBasisPoints, MAX_AMOUNT_PAISE } from '../utils/money.js';

/**
 * Expense validation.
 *
 * Amounts arrive from the client as rupees (what the user typed) and are converted to
 * integer paise here, at the edge. Everything downstream of this file deals only in
 * paise, so a fractional rupee can never reach the domain or the database.
 */

/** Rejects sub-paisa input rather than silently rounding a value the user never agreed to. */
export const amountSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const paise = rupeesToPaise(value);
    if (paise === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid amount, up to two decimal places',
      });
      return z.NEVER;
    }
    return paise;
  })
  .refine((paise) => paise > 0, { message: 'Amount must be greater than zero' })
  .refine((paise) => paise <= MAX_AMOUNT_PAISE, { message: 'That amount is too large' });

export const titleSchema = z
  .string({ required_error: 'Title is required' })
  .trim()
  .min(1, 'Title is required')
  .max(120, 'Title must be at most 120 characters');

export const notesSchema = z
  .string()
  .trim()
  .max(500, 'Notes must be at most 500 characters')
  .optional();

export const categorySchema = z
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
  .nullable()
  .optional();

/**
 * Calendar date, not an instant.
 *
 * The client sends its own local calendar day (`YYYY-MM-DD`), which is what a user means
 * by "the day I spent this". Storing a date rather than a timestamp is what removes the
 * UTC off-by-one that plagues timestamp-based expense dates.
 *
 * A one-day tolerance accommodates a client whose local date is ahead of the server's.
 */
export const expenseDateSchema = z
  .string({ required_error: 'Date is required' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'That date is not valid',
  })
  .refine(
    (value) => {
      const provided = Date.parse(`${value}T00:00:00Z`);
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      return provided <= tomorrow;
    },
    { message: 'An expense cannot be dated in the future' },
  );

const uuidSchema = z.string().uuid('Invalid id');

/**
 * Unequal-split entries.
 *
 * Each mode normalises `value` to an integer here, at the edge, in the unit the domain
 * expects: paise, basis points, or a raw weight. Downstream code compares those totals
 * for exact equality, which only works because nothing fractional gets past this point.
 */
const splitEntriesSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z
    .array(z.object({ userId: uuidSchema, value: valueSchema }).strict())
    .min(1, 'Provide a share for at least one participant')
    .max(200, 'Too many participants');

/** An exact share, entered in rupees like every other amount the user types. */
const exactShareSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const paise = rupeesToPaise(value);
    if (paise === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid share, up to two decimal places',
      });
      return z.NEVER;
    }
    return paise;
  })
  .refine((paise) => paise >= 0, { message: 'A share cannot be negative' })
  .refine((paise) => paise <= MAX_AMOUNT_PAISE, { message: 'That share is too large' });

/** A percentage, normalised to basis points so 33.33 + 33.33 + 33.34 is provably 100. */
const percentageSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const basisPoints = percentToBasisPoints(value);
    if (basisPoints === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a percentage between 0 and 100, up to two decimal places',
      });
      return z.NEVER;
    }
    return basisPoints;
  });

/** A relative weight: "Rahul counts double because he had the room to himself." */
const shareWeightSchema = z.coerce
  .number()
  .int('Shares must be whole numbers')
  .min(0, 'Shares cannot be negative')
  .max(10_000, 'That many shares is not supported');

const SPLIT_MODES = ['everyone', 'specific', 'exact', 'percentage', 'shares'] as const;

/** Modes whose per-participant figures the client must supply. */
const UNEQUAL_MODES: ReadonlySet<string> = new Set(['exact', 'percentage', 'shares']);

const baseExpenseShape = {
  title: titleSchema,
  amount: amountSchema,
  paidBy: uuidSchema.optional(),
  splitType: z.enum(SPLIT_MODES).default('everyone'),
  participantIds: z.array(uuidSchema).max(200, 'Too many participants').optional(),
  /**
   * Per-participant figures for an unequal split. Left deliberately loose here because
   * the unit depends on `splitType`; `applySplitRules` narrows and normalises it once
   * the mode is known.
   */
  splits: splitEntriesSchema(z.union([z.number(), z.string()])).optional(),
  paymentMode: z.enum(['cash', 'upi']).default('cash'),
  category: categorySchema,
  expenseDate: expenseDateSchema,
  notes: notesSchema,
  receiptUrl: z.string().trim().max(1024).nullable().optional(),
  receiptStorageKey: z.string().trim().max(512).nullable().optional(),
  /** Consumed by `requireGroupMember`; accepted here so `.strict()` does not reject it. */
  groupId: uuidSchema.optional(),
};

type SplitShape = {
  splitType?: string;
  participantIds?: string[];
  splits?: { userId: string; value: number | string }[];
};

/** Normalises one entry list against the unit its mode requires. */
const normaliseSplits = (
  mode: string,
  entries: { userId: string; value: number | string }[],
  ctx: z.RefinementCtx,
): { userId: string; value: number }[] | null => {
  const valueSchema =
    mode === 'exact' ? exactShareSchema : mode === 'percentage' ? percentageSchema : shareWeightSchema;

  const normalised: { userId: string; value: number }[] = [];
  let failed = false;

  entries.forEach((entry, index) => {
    const result = valueSchema.safeParse(entry.value);
    if (!result.success) {
      failed = true;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splits', index, 'value'],
        message: result.error.issues[0]?.message ?? 'That share is not valid',
      });
      return;
    }
    normalised.push({ userId: entry.userId, value: result.data as number });
  });

  return failed ? null : normalised;
};

/**
 * Applies the rules that tie `splitType`, `participantIds` and `splits` together, and
 * converts each split value into the integer unit its mode uses.
 *
 * `requireSplits` is false on update: an edit that only changes the title should keep
 * the shares already frozen on the expense rather than being forced to restate them.
 */
const applySplitRules = <T extends z.ZodTypeAny>(schema: T, requireSplits: boolean) =>
  schema.transform((data, ctx) => {
    const value = data as SplitShape;
    const mode = value.splitType;

    if (mode === 'specific' && !(value.participantIds && value.participantIds.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participantIds'],
        message: 'Select at least one participant',
      });
      return z.NEVER;
    }

    const isUnequal = mode !== undefined && UNEQUAL_MODES.has(mode);

    if (!isUnequal && value.splits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splits'],
        message: 'Per-person shares only apply to an exact, percentage or shares split',
      });
      return z.NEVER;
    }

    if (isUnequal && value.participantIds) {
      // The entry list already names everyone involved; a second list could disagree
      // with it, and there would be no principled way to choose between them.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participantIds'],
        message: 'An unequal split is defined by its per-person shares, not participantIds',
      });
      return z.NEVER;
    }

    if (isUnequal && !value.splits && requireSplits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splits'],
        message: 'Provide a share for each participant',
      });
      return z.NEVER;
    }

    // The unit depends on the mode, so shares without a stated mode cannot be read.
    if (value.splits && mode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splitType'],
        message: 'State the split type when providing per-person shares',
      });
      return z.NEVER;
    }

    if (value.splits && mode !== undefined) {
      const normalised = normaliseSplits(mode, value.splits, ctx);
      if (normalised === null) return z.NEVER;
      return { ...(data as object), splits: normalised } as typeof data;
    }

    return data;
  });

export const createExpenseSchema = applySplitRules(
  z.object(baseExpenseShape).strict(),
  true,
);

export const updateExpenseSchema = applySplitRules(
  z
    .object({
      ...baseExpenseShape,
      title: titleSchema.optional(),
      amount: amountSchema.optional(),
      splitType: z.enum(SPLIT_MODES).optional(),
      paymentMode: z.enum(['cash', 'upi']).optional(),
      expenseDate: expenseDateSchema.optional(),
    })
    .strict(),
  false,
);

/** Ledger filters. Mirrors the dashboard's filter vocabulary so the two agree. */
export const listExpensesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    memberId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
    paymentMode: z.enum(['all', 'cash', 'upi']).default('all'),
    category: z
      .enum([
        'all',
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
      .default('all'),
    involvement: z
      .enum(['all', 'involving_me', 'paid_by_me', 'paid_by_others_for_me'])
      .default('all'),
    search: z.string().trim().max(100).optional(),
  })
  .passthrough()
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    path: ['from'],
    message: '"from" must not be after "to"',
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
