import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  activities,
  expenseParticipants,
  expenses,
  groupMembers,
  users,
  type Expense,
} from '../db/schema.js';
import { ERROR_CODES, badRequest, forbidden, notFound } from '../utils/errors.js';
import {
  TOTAL_BASIS_POINTS,
  distributeByWeights,
  distributeShares,
  formatPaise,
  sumPaise,
} from '../utils/money.js';

/**
 * Expense engine.
 *
 * Both create and edit route through `buildSplit`, so there is exactly ONE split
 * algorithm in the system. The reference implementation had two -- a correct
 * remainder-distributing one on create and a naive per-share rounding one on edit --
 * which meant editing a 3-way ₹1000 expense quietly destroyed a paisa. That class of
 * bug cannot recur here: the single algorithm is also backed by a deferred database
 * trigger that refuses to commit a non-reconciling split.
 */

export type SplitMode = 'everyone' | 'specific' | 'exact' | 'percentage' | 'shares';

/**
 * One participant's entry in an unequal split.
 *
 * `value` is already normalised to an integer by the validation layer, in units that
 * depend on the mode: paise for `exact`, basis points for `percentage`, and the raw
 * weight for `shares`. Keeping it integral all the way down is what lets the totals be
 * checked for exact equality rather than within some tolerance.
 */
export type SplitEntry = { userId: string; value: number };

export type SplitInput = {
  groupId: string;
  amountPaise: number;
  splitType: SplitMode;
  paidBy: string;
  participantIds?: string[];
  splits?: SplitEntry[];
};

export type ResolvedSplit = {
  participants: { userId: string; sharePaise: number; splitValue: number | null }[];
};

/** Modes that carry a per-participant figure rather than dividing equally. */
const UNEQUAL_MODES = new Set<SplitMode>(['exact', 'percentage', 'shares']);

/**
 * Validates the caller-supplied entries for an unequal split.
 *
 * Returns the entries in caller order with duplicates rejected. Order matters: the
 * remainder allocation is deterministic given a stable order, so an unchanged edit
 * reproduces an identical split rather than shuffling paise between people.
 */
const readSplitEntries = (input: SplitInput, memberIds: Set<string>): SplitEntry[] => {
  const entries = input.splits ?? [];

  if (entries.length === 0) {
    throw badRequest(
      ERROR_CODES.INVALID_PARTICIPANTS,
      'Provide a share for at least one participant.',
    );
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.userId)) {
      throw badRequest(
        ERROR_CODES.INVALID_PARTICIPANTS,
        'Each participant may appear only once in a split.',
      );
    }
    seen.add(entry.userId);

    if (!memberIds.has(entry.userId)) {
      throw badRequest(
        ERROR_CODES.INVALID_PARTICIPANTS,
        'Every participant must be a member of this group.',
      );
    }

    if (!Number.isSafeInteger(entry.value) || entry.value < 0) {
      throw badRequest(ERROR_CODES.INVALID_PARTICIPANTS, 'Split values must not be negative.');
    }
  }

  return entries;
};

/**
 * Validates the payer and participants against live group membership, then allocates
 * shares with exact reconciliation.
 *
 * Membership is re-proven here on every write. Never trust a client-supplied user id:
 * a participant list is as security-sensitive as the group id itself.
 */
export const buildSplit = async (input: SplitInput): Promise<ResolvedSplit> => {
  const memberRows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, input.groupId));

  const memberIds = new Set(memberRows.map((row) => row.userId));

  if (!memberIds.has(input.paidBy)) {
    throw badRequest(
      ERROR_CODES.PAYER_NOT_IN_GROUP,
      'The payer must be a member of this group.',
    );
  }

  if (UNEQUAL_MODES.has(input.splitType)) {
    const entries = readSplitEntries(input, memberIds);

    if (input.splitType === 'exact') {
      // Entered in rupees, already converted to paise at the edge. The total must match
      // to the paisa; "close enough" would mean somebody silently absorbs the difference.
      const total = sumPaise(entries.map((entry) => entry.value));
      if (total !== input.amountPaise) {
        throw badRequest(
          ERROR_CODES.SHARE_RECONCILIATION_FAILED,
          `The shares add up to ${formatPaise(total)}, but the expense is ${formatPaise(
            input.amountPaise,
          )}.`,
        );
      }

      return {
        participants: entries.map((entry) => ({
          userId: entry.userId,
          sharePaise: entry.value,
          // `share_paise` already is what the user typed, so there is nothing to remember.
          splitValue: null,
        })),
      };
    }

    if (input.splitType === 'percentage') {
      const totalBasisPoints = entries.reduce((total, entry) => total + entry.value, 0);
      if (totalBasisPoints !== TOTAL_BASIS_POINTS) {
        throw badRequest(
          ERROR_CODES.SHARE_RECONCILIATION_FAILED,
          `The percentages add up to ${(totalBasisPoints / 100).toFixed(2)}%, not 100%.`,
        );
      }
    }

    const weights = entries.map((entry) => entry.value);
    if (weights.every((weight) => weight === 0)) {
      throw badRequest(
        ERROR_CODES.INVALID_PARTICIPANTS,
        'At least one participant must have a share above zero.',
      );
    }

    const shares = distributeByWeights(input.amountPaise, weights);

    if (sumPaise(shares) !== input.amountPaise) {
      throw badRequest(
        ERROR_CODES.SHARE_RECONCILIATION_FAILED,
        'Split shares did not reconcile with the expense total.',
      );
    }

    return {
      participants: entries.map((entry, index) => ({
        userId: entry.userId,
        sharePaise: shares[index]!,
        splitValue: entry.value,
      })),
    };
  }

  let targetIds: string[];

  if (input.splitType === 'everyone') {
    // Snapshot of who is in the group right now. Once written, this list is frozen.
    targetIds = memberRows.map((row) => row.userId);
  } else {
    // Deduplicate but preserve caller order, so remainder paise land predictably.
    targetIds = [...new Set(input.participantIds ?? [])];
    if (targetIds.length === 0) {
      throw badRequest(
        ERROR_CODES.INVALID_PARTICIPANTS,
        'Select at least one participant.',
      );
    }
    const outsider = targetIds.find((id) => !memberIds.has(id));
    if (outsider) {
      throw badRequest(
        ERROR_CODES.INVALID_PARTICIPANTS,
        'Every participant must be a member of this group.',
      );
    }
  }

  if (targetIds.length === 0) {
    throw badRequest(ERROR_CODES.INVALID_PARTICIPANTS, 'This group has no members to split across.');
  }

  const shares = distributeShares(input.amountPaise, targetIds.length);

  // Belt and braces: the DB trigger would catch this, but failing here gives a clean
  // domain error instead of a transaction abort.
  if (sumPaise(shares) !== input.amountPaise) {
    throw badRequest(
      ERROR_CODES.SHARE_RECONCILIATION_FAILED,
      'Split shares did not reconcile with the expense total.',
    );
  }

  return {
    participants: targetIds.map((userId, index) => ({
      userId,
      sharePaise: shares[index]!,
      splitValue: null,
    })),
  };
};

export type CreateExpenseInput = {
  groupId: string;
  actorUserId: string;
  title: string;
  amountPaise: number;
  paidBy: string;
  splitType: SplitMode;
  participantIds?: string[];
  splits?: SplitEntry[];
  paymentMode: 'cash' | 'upi';
  category?: string | null;
  expenseDate: string;
  notes?: string;
  receiptUrl?: string | null;
  receiptStorageKey?: string | null;
};

export type ExpenseWithParticipants = Expense & {
  participants: { userId: string; sharePaise: number; splitValue: number | null }[];
};

/** Writes the expense and its frozen participant shares in one transaction. */
export const createExpense = async (
  input: CreateExpenseInput,
): Promise<ExpenseWithParticipants> => {
  const split = await buildSplit({
    groupId: input.groupId,
    amountPaise: input.amountPaise,
    splitType: input.splitType,
    paidBy: input.paidBy,
    participantIds: input.participantIds,
    splits: input.splits,
  });

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(expenses)
      .values({
        groupId: input.groupId,
        title: input.title,
        amountPaise: input.amountPaise,
        paidBy: input.paidBy,
        splitType: input.splitType,
        paymentMode: input.paymentMode,
        category: (input.category ?? null) as Expense['category'],
        expenseDate: input.expenseDate,
        notes: input.notes ?? '',
        receiptUrl: input.receiptUrl ?? null,
        receiptStorageKey: input.receiptStorageKey ?? null,
        createdBy: input.actorUserId,
      })
      .returning();

    const expense = inserted[0]!;

    await tx.insert(expenseParticipants).values(
      split.participants.map((participant) => ({
        expenseId: expense.id,
        userId: participant.userId,
        sharePaise: participant.sharePaise,
        splitValue: participant.splitValue,
      })),
    );

    await tx.insert(activities).values({
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      type: 'expense_created',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { title: expense.title, amountPaise: expense.amountPaise },
    });

    return { ...expense, participants: split.participants };
  });
};

export type UpdateExpenseInput = Partial<
  Omit<CreateExpenseInput, 'groupId' | 'actorUserId'>
> & {
  expenseId: string;
  groupId: string;
  actorUserId: string;
};

/**
 * Edits an expense and recomputes its frozen shares through the same splitter as create.
 *
 * Authorization matches the reference: only the original payer may edit. The group scope
 * is also re-checked, which the reference omitted -- it relied on the payer check alone.
 */
export const updateExpense = async (
  input: UpdateExpenseInput,
): Promise<ExpenseWithParticipants> => {
  const existingRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, input.expenseId), eq(expenses.groupId, input.groupId)))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw notFound('Expense not found.');

  if (existing.paidBy !== input.actorUserId) {
    throw forbidden(
      ERROR_CODES.FORBIDDEN,
      'Only the person who paid for this expense can edit it.',
    );
  }

  const amountPaise = input.amountPaise ?? existing.amountPaise;
  const paidBy = input.paidBy ?? existing.paidBy;
  const splitType = input.splitType ?? existing.splitType;

  // When switching to (or staying on) a split that names its participants without
  // supplying a new list, reuse what is already frozen on the expense rather than
  // silently widening it -- or, for an unequal split, quietly flattening it to equal.
  let participantIds = input.participantIds;
  let splits = input.splits;

  const needsExistingParticipants =
    (splitType === 'specific' && !participantIds) ||
    (UNEQUAL_MODES.has(splitType) && !splits && UNEQUAL_MODES.has(existing.splitType));

  if (needsExistingParticipants) {
    const current = await db
      .select({
        userId: expenseParticipants.userId,
        sharePaise: expenseParticipants.sharePaise,
        splitValue: expenseParticipants.splitValue,
      })
      .from(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, existing.id));

    if (splitType === 'specific') {
      participantIds = current.map((row) => row.userId);
    } else {
      // Editing only the title of a 60/40 expense must not lose the 60/40. `exact`
      // keeps its paise; the other modes kept the user's intent in `split_value`.
      splits = current.map((row) => ({
        userId: row.userId,
        value: splitType === 'exact' ? row.sharePaise : (row.splitValue ?? 0),
      }));
    }
  }

  const split = await buildSplit({
    groupId: input.groupId,
    amountPaise,
    splitType,
    paidBy,
    participantIds,
    splits,
  });

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(expenses)
      .set({
        title: input.title ?? existing.title,
        amountPaise,
        paidBy,
        splitType,
        paymentMode: input.paymentMode ?? existing.paymentMode,
        category: (input.category === undefined
          ? existing.category
          : input.category) as Expense['category'],
        expenseDate: input.expenseDate ?? existing.expenseDate,
        notes: input.notes ?? existing.notes,
        receiptUrl: input.receiptUrl === undefined ? existing.receiptUrl : input.receiptUrl,
        receiptStorageKey:
          input.receiptStorageKey === undefined
            ? existing.receiptStorageKey
            : input.receiptStorageKey,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, existing.id))
      .returning();

    // Replace the whole frozen set: a partial update could leave a stale participant
    // whose share no longer reconciles.
    await tx.delete(expenseParticipants).where(eq(expenseParticipants.expenseId, existing.id));
    await tx.insert(expenseParticipants).values(
      split.participants.map((participant) => ({
        expenseId: existing.id,
        userId: participant.userId,
        sharePaise: participant.sharePaise,
        splitValue: participant.splitValue,
      })),
    );

    await tx.insert(activities).values({
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      type: 'expense_updated',
      entityType: 'expense',
      entityId: existing.id,
      metadata: {
        title: updated[0]!.title,
        amountPaise,
        previousAmountPaise: existing.amountPaise,
      },
    });

    return { ...updated[0]!, participants: split.participants };
  });
};

/**
 * Deletes an expense. Participant rows cascade, which removes the expense's entire
 * contribution to the debt graph -- balances are always derived, never stored, so there
 * is no separate reversal step that could be missed.
 *
 * Returns the receipt storage key so the caller can clean up the stored file.
 */
export const deleteExpense = async (
  expenseId: string,
  groupId: string,
  actorUserId: string,
  /**
   * Lets an administrator delete an expense they did not pay for.
   *
   * This waives AUTHORISATION only -- who is permitted to act -- and nothing else. The
   * deletion still runs the same transaction, participant rows still cascade, and
   * balances are still derived from what remains, so financial integrity is untouched.
   * An admin can never bypass a domain rule this way, only an ownership check, and the
   * caller records an audit row for it.
   */
  options: { bypassOwnership?: boolean } = {},
): Promise<{ deleted: Expense; receiptStorageKey: string | null }> => {
  const existingRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw notFound('Expense not found.');

  if (!options.bypassOwnership && existing.paidBy !== actorUserId) {
    throw forbidden(
      ERROR_CODES.FORBIDDEN,
      'Only the person who paid for this expense can delete it.',
    );
  }

  return db.transaction(async (tx) => {
    await tx.delete(expenses).where(eq(expenses.id, existing.id));

    await tx.insert(activities).values({
      groupId,
      actorUserId,
      type: 'expense_deleted',
      entityType: 'expense',
      entityId: existing.id,
      metadata: { title: existing.title, amountPaise: existing.amountPaise },
    });

    return { deleted: existing, receiptStorageKey: existing.receiptStorageKey };
  });
};

/** One expense with its frozen participant shares and payer details. */
export const getExpenseDetail = async (expenseId: string, groupId: string) => {
  const rows = await db
    .select({ expense: expenses, payer: users })
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.paidBy))
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound('Expense not found.');

  const participants = await db
    .select({
      userId: expenseParticipants.userId,
      sharePaise: expenseParticipants.sharePaise,
      splitValue: expenseParticipants.splitValue,
      user: users,
    })
    .from(expenseParticipants)
    .innerJoin(users, eq(users.id, expenseParticipants.userId))
    .where(eq(expenseParticipants.expenseId, expenseId));

  return { ...row, participants };
};

export type ListExpensesOptions = {
  groupId: string;
  /** The caller, for involvement filters and per-row share resolution. */
  viewerId: string;
  limit: number;
  offset: number;
  from?: string;
  to?: string;
  memberId?: string;
  paymentMode?: 'cash' | 'upi';
  category?: string;
  involvement?: 'all' | 'involving_me' | 'paid_by_me' | 'paid_by_others_for_me';
  search?: string;
};

/**
 * Paginated, filtered group expense ledger, newest first.
 *
 * The predicate mirrors the reporting service's `buildScope` so the ledger and the
 * dashboard agree about what a filter means. Always bounded: there is no code path that
 * returns every expense in a group.
 */
export const listExpenses = async (options: ListExpensesOptions) => {
  const conditions: SQL[] = [sql`e.group_id = ${options.groupId}`];

  if (options.from) conditions.push(sql`e.expense_date >= ${options.from}::date`);
  if (options.to) conditions.push(sql`e.expense_date <= ${options.to}::date`);
  if (options.paymentMode) {
    conditions.push(sql`e.payment_mode = ${options.paymentMode}::payment_mode`);
  }
  if (options.category) {
    conditions.push(sql`e.category = ${options.category}::expense_category`);
  }
  if (options.search) {
    // Case-insensitive substring over title and notes.
    const pattern = `%${options.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(sql`(e.title ilike ${pattern} or e.notes ilike ${pattern})`);
  }
  if (options.memberId) {
    conditions.push(sql`(
      e.paid_by = ${options.memberId}
      or exists (
        select 1 from expense_participants ep
         where ep.expense_id = e.id and ep.user_id = ${options.memberId}
      )
    )`);
  }

  const iBenefit = sql`exists (
    select 1 from expense_participants ep
     where ep.expense_id = e.id and ep.user_id = ${options.viewerId}
  )`;

  switch (options.involvement) {
    case 'paid_by_me':
      conditions.push(sql`e.paid_by = ${options.viewerId}`);
      break;
    case 'paid_by_others_for_me':
      conditions.push(sql`e.paid_by <> ${options.viewerId} and ${iBenefit}`);
      break;
    case 'involving_me':
      conditions.push(sql`(e.paid_by = ${options.viewerId} or ${iBenefit})`);
      break;
    default:
      break;
  }

  const where = sql.join(conditions, sql` and `);

  const idRows = await db.execute<{ id: string }>(sql`
    select e.id from expenses e
     where ${where}
     order by e.expense_date desc, e.created_at desc
     limit ${options.limit} offset ${options.offset}
  `);

  const totalResult = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from expenses e where ${where}
  `);

  const orderedIds = idRows.rows.map((row) => row.id);

  const rows = orderedIds.length
    ? (
        await db
          .select({ expense: expenses, payer: users })
          .from(expenses)
          .innerJoin(users, eq(users.id, expenses.paidBy))
          .where(inArray(expenses.id, orderedIds))
      ).sort((a, b) => orderedIds.indexOf(a.expense.id) - orderedIds.indexOf(b.expense.id))
    : [];

  const totalRows = [{ count: totalResult.rows[0]?.count ?? 0 }];

  const expenseIds = rows.map((row) => row.expense.id);
  const participants = expenseIds.length
    ? await db
        .select({
          expenseId: expenseParticipants.expenseId,
          userId: expenseParticipants.userId,
          sharePaise: expenseParticipants.sharePaise,
          splitValue: expenseParticipants.splitValue,
        })
        .from(expenseParticipants)
        .where(inArray(expenseParticipants.expenseId, expenseIds))
    : [];

  // One extra query for all participants, then grouped in memory: avoids N+1.
  const byExpense = new Map<string, { userId: string; sharePaise: number }[]>();
  for (const row of participants) {
    const list = byExpense.get(row.expenseId) ?? [];
    list.push({ userId: row.userId, sharePaise: row.sharePaise });
    byExpense.set(row.expenseId, list);
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      participants: byExpense.get(row.expense.id) ?? [],
    })),
    total: totalRows[0]?.count ?? 0,
  };
};
