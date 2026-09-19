import { and, between, count, eq, gte, inArray, lte, sql, sum, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  activities,
  expenseParticipants,
  expenses,
  groups,
  purgeAudits,
  settlements,
  users,
} from '../db/schema.js';
import { ERROR_CODES, badRequest, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { uuidList } from '../utils/sqlHelpers.js';

/**
 * History purge.
 *
 * CONTRACT
 * --------
 * A purge permanently destroys financial records, so this module is built around one
 * rule: **a purge may never change what anybody owes**. Before deleting anything it
 * recomputes the group's debts as they would be afterwards and refuses if they differ
 * from the debts today.
 *
 * That single rule removes the whole class of disasters this feature could otherwise
 * cause -- deleting an unsettled expense (a debt silently vanishes) or deleting a
 * settlement without its expense (a cleared debt comes back). The operator is told
 * exactly which debts are blocking and can settle up or narrow the range.
 *
 * The deletion itself runs in one transaction, and an audit row recording what was
 * destroyed is written inside it. `purge_audits` has no delete endpoint anywhere.
 */

export type PurgeFilters = {
  groupId: string;
  from: string;
  to: string;
  /** Optional narrowing, mirroring the ledger's own filter vocabulary. */
  memberId?: string;
  category?: string;
  paymentMode?: 'cash' | 'upi';
  /** Whether to remove activity-feed entries in the window as well. */
  includeActivities?: boolean;
};

export type PurgePreview = {
  from: string;
  to: string;
  expenseCount: number;
  settlementCount: number;
  activityCount: number;
  amountPaise: number;
  /** Empty when the purge is safe. Otherwise the debts that must be cleared first. */
  /**
   * Pairs whose net position the purge would move. Empty means the purge is safe.
   * `beforePaise`/`afterPaise` are raw nets, so they can legitimately be negative.
   */
  blockingDebts: {
    debtorId: string;
    debtorName: string;
    creditorId: string;
    creditorName: string;
    owedPaise: number;
    beforePaise: number;
    afterPaise: number;
  }[];
  safe: boolean;
};

/** Expense predicates for the requested window and filters. */
const expenseConditions = (filters: PurgeFilters): SQL[] => {
  const conditions: SQL[] = [
    eq(expenses.groupId, filters.groupId),
    gte(expenses.expenseDate, filters.from),
    lte(expenses.expenseDate, filters.to),
  ];

  if (filters.category) {
    conditions.push(eq(expenses.category, filters.category as never));
  }
  if (filters.paymentMode) {
    conditions.push(eq(expenses.paymentMode, filters.paymentMode));
  }
  if (filters.memberId) {
    // "Involving this person": they paid, or they carry a share.
    conditions.push(
      sql`(${expenses.paidBy} = ${filters.memberId} or exists (
        select 1 from ${expenseParticipants} ep
         where ep.expense_id = ${expenses.id}
           and ep.user_id = ${filters.memberId}
      ))`,
    );
  }

  return conditions;
};

/**
 * Settlement predicates.
 *
 * Settlements are matched on `paid_at`, which is the day the money moved -- the same
 * thing `expense_date` means for an expense. Using `created_at` would put a payment
 * recorded late into the wrong window.
 */
const settlementConditions = (filters: PurgeFilters): SQL[] => {
  const conditions: SQL[] = [
    eq(settlements.groupId, filters.groupId),
    gte(settlements.paidAt, new Date(`${filters.from}T00:00:00.000Z`)),
    lte(settlements.paidAt, new Date(`${filters.to}T23:59:59.999Z`)),
  ];

  if (filters.memberId) {
    conditions.push(
      sql`(${settlements.payerId} = ${filters.memberId} or ${settlements.receiverId} = ${filters.memberId})`,
    );
  }
  if (filters.paymentMode) {
    conditions.push(eq(settlements.paymentMethod, filters.paymentMode));
  }

  return conditions;
};

/**
 * Raw net position for every pair, optionally excluding rows a purge would remove.
 *
 * Deliberately UNCLAMPED, unlike `getPairwiseDebts`. The live engine floors each
 * direction at zero because a negative debt is not a thing anyone owes -- but that
 * clamp hides exactly the damage this check exists to catch. Deleting an expense whose
 * debt had been settled exactly leaves the pair at 0 before and 0 after, while the
 * underlying net silently becomes -500: a stale credit that would absorb the next real
 * expense. Comparing raw nets catches it; comparing clamped debts does not.
 */
const netByPair = async (
  groupId: string,
  expenseIds: string[],
  settlementIds: string[],
): Promise<Map<string, number>> => {
  // Branch rather than using a sentinel id: an empty exclusion means "exclude nothing",
  // which is a different predicate, not a list containing an impossible value.
  const excludeExpenses =
    expenseIds.length > 0 ? sql`and e.id not in ${uuidList(expenseIds)}` : sql``;
  const excludeSettlements =
    settlementIds.length > 0 ? sql`and id not in ${uuidList(settlementIds)}` : sql``;

  const result = await db.execute<{
    debtor_id: string;
    creditor_id: string;
    owed_paise: string | number;
  }>(sql`
    with expense_debt as (
      select ep.user_id as debtor_id,
             e.paid_by  as creditor_id,
             sum(ep.share_paise)::bigint as paise
        from expense_participants ep
        join expenses e on e.id = ep.expense_id
       where e.group_id = ${groupId}
         and ep.user_id <> e.paid_by
         ${excludeExpenses}
       group by 1, 2
    ),
    settled as (
      select payer_id    as debtor_id,
             receiver_id as creditor_id,
             sum(amount_paise)::bigint as paise
        from settlements
       where group_id = ${groupId}
         and status = 'completed'
         ${excludeSettlements}
       group by 1, 2
    ),
    pairs as (
      select debtor_id, creditor_id from expense_debt
      union
      select debtor_id, creditor_id from settled
    )
    select p.debtor_id,
           p.creditor_id,
           (coalesce(ed.paise, 0) - coalesce(s.paise, 0))::bigint as owed_paise
      from pairs p
      left join expense_debt ed
             on ed.debtor_id = p.debtor_id and ed.creditor_id = p.creditor_id
      left join settled s
             on s.debtor_id = p.debtor_id and s.creditor_id = p.creditor_id
  `);

  return new Map(
    result.rows.map((row) => [`${row.debtor_id}:${row.creditor_id}`, Number(row.owed_paise)]),
  );
};

/** Ids the filters select, shared by preview and execute so they can never disagree. */
const selectTargets = async (filters: PurgeFilters) => {
  const expenseRows = await db
    .select({ id: expenses.id, amountPaise: expenses.amountPaise })
    .from(expenses)
    .where(and(...expenseConditions(filters)));

  const settlementRows = await db
    .select({ id: settlements.id })
    .from(settlements)
    .where(and(...settlementConditions(filters)));

  return {
    expenseIds: expenseRows.map((row) => row.id),
    settlementIds: settlementRows.map((row) => row.id),
    amountPaise: expenseRows.reduce((total, row) => total + row.amountPaise, 0),
  };
};

/**
 * Describes what a purge would do, and whether it is allowed.
 *
 * Always run before `executePurge`, and run again inside it -- the preview the operator
 * saw may be seconds stale, and the check that matters is the one at deletion time.
 */
export const previewPurge = async (filters: PurgeFilters): Promise<PurgePreview> => {
  if (filters.from > filters.to) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, '"From" must not be after "to".');
  }

  const { expenseIds, settlementIds, amountPaise } = await selectTargets(filters);

  const activityRows = filters.includeActivities
    ? await db
        .select({ value: count() })
        .from(activities)
        .where(
          and(
            eq(activities.groupId, filters.groupId),
            between(
              activities.createdAt,
              new Date(`${filters.from}T00:00:00.000Z`),
              new Date(`${filters.to}T23:59:59.999Z`),
            ),
          ),
        )
    : [];

  const before = await netByPair(filters.groupId, [], []);
  const after = await netByPair(filters.groupId, expenseIds, settlementIds);

  // Any pair whose net moves at all blocks the purge, in either direction.
  const changedKeys = [...new Set<string>([...before.keys(), ...after.keys()])].filter(
    (key) => (before.get(key) ?? 0) !== (after.get(key) ?? 0),
  );

  let blockingDebts: PurgePreview['blockingDebts'] = [];

  if (changedKeys.length > 0) {
    const ids = [...new Set(changedKeys.flatMap((key) => key.split(':')))];
    const people = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, ids));
    const nameById = new Map(people.map((person) => [person.id, person.fullName]));

    blockingDebts = changedKeys.map((key) => {
      const [debtorId, creditorId] = key.split(':') as [string, string];
      const beforePaise = before.get(key) ?? 0;
      const afterPaise = after.get(key) ?? 0;
      return {
        debtorId,
        debtorName: nameById.get(debtorId) ?? 'Unknown',
        creditorId,
        creditorName: nameById.get(creditorId) ?? 'Unknown',
        // What it is now, and what the purge would silently turn it into.
        owedPaise: beforePaise,
        beforePaise,
        afterPaise,
      };
    });
  }

  return {
    from: filters.from,
    to: filters.to,
    expenseCount: expenseIds.length,
    settlementCount: settlementIds.length,
    activityCount: Number(activityRows[0]?.value ?? 0),
    amountPaise,
    blockingDebts,
    safe: blockingDebts.length === 0,
  };
};

export type PurgeResult = {
  expensesDeleted: number;
  settlementsDeleted: number;
  activitiesDeleted: number;
  amountPaise: number;
};

/**
 * Performs the purge.
 *
 * Re-checks safety immediately before deleting rather than trusting the preview the
 * caller saw, then deletes and writes the audit row in a single transaction so a record
 * of the destruction can never be lost while the destruction itself succeeds.
 */
export const executePurge = async (
  filters: PurgeFilters,
  actor: { id: string; email: string },
): Promise<PurgeResult> => {
  const groupRows = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.id, filters.groupId))
    .limit(1);

  const group = groupRows[0];
  if (!group) throw notFound('Group not found.');

  const preview = await previewPurge(filters);

  if (!preview.safe) {
    throw badRequest(
      ERROR_CODES.PURGE_WOULD_CHANGE_BALANCES,
      'This range still contains unsettled money, so clearing it would change what people owe. Settle up first, or choose a narrower range.',
    );
  }

  if (preview.expenseCount === 0 && preview.settlementCount === 0 && preview.activityCount === 0) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'Nothing matches that range.');
  }

  const { expenseIds, settlementIds, amountPaise } = await selectTargets(filters);

  return db.transaction(async (tx) => {
    let activitiesDeleted = 0;

    if (filters.includeActivities) {
      const removed = await tx
        .delete(activities)
        .where(
          and(
            eq(activities.groupId, filters.groupId),
            between(
              activities.createdAt,
              new Date(`${filters.from}T00:00:00.000Z`),
              new Date(`${filters.to}T23:59:59.999Z`),
            ),
          ),
        )
        .returning({ id: activities.id });
      activitiesDeleted = removed.length;
    }

    // Participant rows cascade from the expense, so the debt graph loses the whole
    // contribution atomically.
    if (settlementIds.length > 0) {
      await tx.delete(settlements).where(inArray(settlements.id, settlementIds));
    }
    if (expenseIds.length > 0) {
      await tx.delete(expenses).where(inArray(expenses.id, expenseIds));
    }

    await tx.insert(purgeAudits).values({
      groupId: group.id,
      groupName: group.name,
      actorUserId: actor.id,
      actorEmail: actor.email,
      fromDate: filters.from,
      toDate: filters.to,
      expensesDeleted: expenseIds.length,
      settlementsDeleted: settlementIds.length,
      activitiesDeleted,
      amountPurgedPaise: amountPaise,
      filters: {
        memberId: filters.memberId ?? null,
        category: filters.category ?? null,
        paymentMode: filters.paymentMode ?? null,
        includeActivities: Boolean(filters.includeActivities),
      },
    });

    logger.warn('history.purged', {
      groupId: group.id,
      actorId: actor.id,
      from: filters.from,
      to: filters.to,
      expenses: expenseIds.length,
      settlements: settlementIds.length,
      activities: activitiesDeleted,
    });

    return {
      expensesDeleted: expenseIds.length,
      settlementsDeleted: settlementIds.length,
      activitiesDeleted,
      amountPaise,
    };
  });
};

/** Purge history, newest first. Read-only everywhere it is exposed. */
export const listPurgeAudits = async (options: {
  groupId?: string;
  limit: number;
  offset: number;
}) => {
  const conditions: SQL[] = [];
  if (options.groupId) conditions.push(eq(purgeAudits.groupId, options.groupId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(purgeAudits)
    .where(where)
    .orderBy(sql`${purgeAudits.createdAt} desc`)
    .limit(options.limit)
    .offset(options.offset);

  const totals = await db.select({ value: count() }).from(purgeAudits).where(where);

  return { rows, total: Number(totals[0]?.value ?? 0) };
};
