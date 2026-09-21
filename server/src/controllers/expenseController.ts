import type { Request, Response } from 'express';
import { sendOk } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { paiseToRupees } from '../utils/money.js';
import { validated, validatedQuery } from '../middleware/validate.js';
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  updateExpenseSchema,
} from '../validation/expenseSchemas.js';
import * as expenseService from '../services/expenseService.js';
import { publishToGroup } from '../realtime/socketServer.js';
import { REALTIME_EVENTS } from '../realtime/events.js';
import * as notificationService from '../services/notificationService.js';
import * as pushService from '../services/pushService.js';
import { formatPaise } from '../utils/money.js';
import type { Expense, User } from '../db/schema.js';

/**
 * Presenter.
 *
 * Every money field is emitted twice: `*Paise` as the authoritative integer, and a
 * rupee number for convenience. Clients should compute with paise and render rupees;
 * shipping only rupees would invite float arithmetic back into the frontend.
 */
const publicExpense = (
  expense: Expense,
  participants: { userId: string; sharePaise: number; splitValue?: number | null }[],
  payer?: Pick<User, 'id' | 'fullName' | 'email'>,
  viewerId?: string,
) => {
  const myShare = participants.find((p) => p.userId === viewerId);

  return {
    id: expense.id,
    groupId: expense.groupId,
    title: expense.title,
    amountPaise: expense.amountPaise,
    amount: paiseToRupees(expense.amountPaise),
    paidBy: expense.paidBy,
    payer: payer ? { id: payer.id, fullName: payer.fullName, email: payer.email } : undefined,
    splitType: expense.splitType,
    paymentMode: expense.paymentMode,
    category: expense.category,
    expenseDate: expense.expenseDate,
    notes: expense.notes,
    receiptUrl: expense.receiptUrl,
    hasReceipt: Boolean(expense.receiptUrl),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    participantCount: participants.length,
    participants: participants.map((p) => ({
      userId: p.userId,
      sharePaise: p.sharePaise,
      share: paiseToRupees(p.sharePaise),
      // What the user originally entered, so the edit dialog can reopen on "60%"
      // rather than on the paise that 60% happened to resolve to.
      splitValue: p.splitValue ?? null,
    })),
    ...(viewerId
      ? {
          mySharePaise: myShare?.sharePaise ?? 0,
          myShare: paiseToRupees(myShare?.sharePaise ?? 0),
          involvement:
            expense.paidBy === viewerId
              ? 'paid_by_me'
              : myShare
                ? 'paid_by_others_for_me'
                : 'not_involved',
        }
      : {}),
  };
};

export const createExpense = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, createExpenseSchema);
  const groupId = req.group!.id;

  const expense = await expenseService.createExpense({
    groupId,
    actorUserId: req.user!.id,
    title: input.title,
    amountPaise: input.amount,
    // Defaults to the caller; `buildSplit` still proves the payer is a member.
    paidBy: input.paidBy ?? req.user!.id,
    splitType: input.splitType,
    participantIds: input.participantIds,
    splits: input.splits,
    paymentMode: input.paymentMode,
    category: input.category ?? null,
    expenseDate: input.expenseDate,
    notes: input.notes ?? '',
    receiptUrl: input.receiptUrl ?? null,
    receiptStorageKey: input.receiptStorageKey ?? null,
  });

  logger.info('expense.created', {
    expenseId: expense.id,
    groupId,
    actorId: req.user!.id,
    amountPaise: expense.amountPaise,
  });

  void notificationService.notifyUsers(
    expense.participants
      .map((participant) => participant.userId)
      .filter((userId) => userId !== req.user!.id),
    {
      senderUserId: req.user!.id,
      groupId,
      type: 'expense_added',
      title: `New expense: ${expense.title}`,
      // One row is inserted per recipient with identical text, so the message must be
      // true for all of them. Individual shares can differ by a paisa, so it states the
      // total and the split size rather than "your share is X".
      message: `${req.user!.fullName} added ${formatPaise(expense.amountPaise)}, split ${
        expense.participants.length
      } ways.`,
      entityType: 'expense',
      entityId: expense.id,
    },
  );

  void pushService.sendToUsers(
    expense.participants
      .map((participant) => participant.userId)
      .filter((userId) => userId !== req.user!.id),
    {
      title: `New expense: ${expense.title}`,
      body: `${req.user!.fullName} added ${formatPaise(expense.amountPaise)}`,
      url: '/app/expenses',
      tag: `expense-${expense.id}`,
    },
  );

  publishToGroup({
    event: REALTIME_EVENTS.EXPENSE_CREATED,
    groupId,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: expense.id,
    message: `${req.user!.fullName} added "${expense.title}" (${formatPaise(expense.amountPaise)})`,
  });

  sendOk(
    res,
    { expense: publicExpense(expense, expense.participants, undefined, req.user!.id) },
    201,
  );
};

export const listExpenses = async (req: Request, res: Response): Promise<void> => {
  const filters = validatedQuery(req, listExpensesQuerySchema);

  const { rows, total } = await expenseService.listExpenses({
    groupId: req.group!.id,
    viewerId: req.user!.id,
    limit: filters.limit,
    offset: filters.offset,
    // "all" is the absence of a filter, not a value to match against.
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.memberId !== 'all' ? { memberId: filters.memberId } : {}),
    ...(filters.paidBy !== 'all' ? { paidBy: filters.paidBy } : {}),
    ...(filters.paymentMode !== 'all' ? { paymentMode: filters.paymentMode } : {}),
    ...(filters.category !== 'all' ? { category: filters.category } : {}),
    ...(filters.involvement !== 'all' ? { involvement: filters.involvement } : {}),
    ...(filters.search ? { search: filters.search } : {}),
  });

  const { limit, offset } = filters;

  sendOk(res, {
    expenses: rows.map((row) =>
      publicExpense(row.expense, row.participants, row.payer, req.user!.id),
    ),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
};

export const getExpense = async (req: Request, res: Response): Promise<void> => {
  const detail = await expenseService.getExpenseDetail(
    String(req.params.expenseId),
    req.group!.id,
  );

  sendOk(res, {
    expense: {
      ...publicExpense(detail.expense, detail.participants, detail.payer, req.user!.id),
      // Detail view resolves participant identities for the split table.
      participants: detail.participants.map((p) => ({
        userId: p.userId,
        fullName: p.user.fullName,
        email: p.user.email,
        sharePaise: p.sharePaise,
        share: paiseToRupees(p.sharePaise),
        splitValue: p.splitValue ?? null,
        isPayer: p.userId === detail.expense.paidBy,
      })),
    },
  });
};

export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, updateExpenseSchema);

  const expense = await expenseService.updateExpense({
    expenseId: String(req.params.expenseId),
    groupId: req.group!.id,
    actorUserId: req.user!.id,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.amount !== undefined ? { amountPaise: input.amount } : {}),
    ...(input.paidBy !== undefined ? { paidBy: input.paidBy } : {}),
    ...(input.splitType !== undefined ? { splitType: input.splitType } : {}),
    ...(input.participantIds !== undefined ? { participantIds: input.participantIds } : {}),
    ...(input.splits !== undefined ? { splits: input.splits } : {}),
    ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.expenseDate !== undefined ? { expenseDate: input.expenseDate } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.receiptUrl !== undefined ? { receiptUrl: input.receiptUrl } : {}),
    ...(input.receiptStorageKey !== undefined
      ? { receiptStorageKey: input.receiptStorageKey }
      : {}),
  });

  logger.info('expense.updated', {
    expenseId: expense.id,
    groupId: req.group!.id,
    actorId: req.user!.id,
  });

  publishToGroup({
    event: REALTIME_EVENTS.EXPENSE_UPDATED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: expense.id,
    message: `${req.user!.fullName} updated "${expense.title}"`,
  });

  sendOk(res, {
    expense: publicExpense(expense, expense.participants, undefined, req.user!.id),
  });
};

export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  const result = await expenseService.deleteExpense(
    String(req.params.expenseId),
    req.group!.id,
    req.user!.id,
  );

  logger.info('expense.deleted', {
    expenseId: result.deleted.id,
    groupId: req.group!.id,
    actorId: req.user!.id,
  });

  publishToGroup({
    event: REALTIME_EVENTS.EXPENSE_DELETED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: result.deleted.id,
    message: `${req.user!.fullName} deleted "${result.deleted.title}"`,
  });

  sendOk(res, { deleted: true, expenseId: result.deleted.id });
};
