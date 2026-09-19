import { and, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  activities,
  expenses,
  groupMembers,
  groups,
  settlements,
  users,
} from '../db/schema.js';
import { getPairwiseDebts, getOutstandingBetween } from './balanceService.js';
import * as auditService from './auditService.js';
import { ERROR_CODES, badRequest, notFound } from '../utils/errors.js';

/**
 * Admin operations that span more than one aggregate.
 *
 * COMPOSES, NEVER DUPLICATES
 * --------------------------
 * Everything financial here delegates to the existing engines. Debts come from
 * `balanceService` and nowhere else; expense and settlement mutations go through their
 * own services with an explicit authorisation override. There is deliberately no
 * arithmetic on money in this file -- a second balance calculation that drifted from the
 * first would be the worst possible bug in this product.
 */

/* -------------------------------------------------------------------------- */
/* Group detail                                                               */
/* -------------------------------------------------------------------------- */

export type GroupDetail = Awaited<ReturnType<typeof getGroupDetail>>;

/**
 * Everything the group detail screen needs, in one round trip.
 *
 * Balances come from the authoritative engine, so the admin view and the members' own
 * view can never disagree about who owes what.
 */
export const getGroupDetail = async (groupId: string) => {
  const groupRows = await db
    .select({
      group: groups,
      creator: { id: users.id, fullName: users.fullName, email: users.email },
    })
    .from(groups)
    .innerJoin(users, eq(users.id, groups.createdBy))
    .where(eq(groups.id, groupId))
    .limit(1);

  const row = groupRows[0];
  if (!row) throw notFound('Group not found.');

  const members = await db
    .select({ membership: groupMembers, user: users })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt);

  const [expenseStats] = await db
    .select({
      total: count(),
      value: sql<string>`coalesce(sum(${expenses.amountPaise}), 0)::bigint`,
    })
    .from(expenses)
    .where(eq(expenses.groupId, groupId));

  const [settlementStats] = await db
    .select({ total: count() })
    .from(settlements)
    .where(eq(settlements.groupId, groupId));

  const [completed] = await db
    .select({ value: sql<string>`coalesce(sum(${settlements.amountPaise}), 0)::bigint` })
    .from(settlements)
    .where(and(eq(settlements.groupId, groupId), eq(settlements.status, 'completed')));

  const [pending] = await db
    .select({ value: count() })
    .from(settlements)
    .where(
      and(eq(settlements.groupId, groupId), eq(settlements.status, 'paid_pending_approval')),
    );

  const [activityCount] = await db
    .select({ value: count() })
    .from(activities)
    .where(eq(activities.groupId, groupId));

  // The one source of truth for obligations.
  const debts = await getPairwiseDebts(groupId);
  const nameById = new Map(members.map((m) => [m.user.id, m.user.fullName]));

  return {
    group: row.group,
    creator: row.creator,
    members: members.map((m) => ({
      id: m.user.id,
      fullName: m.user.fullName,
      email: m.user.email,
      status: m.user.status,
      role: m.membership.role,
      joinedAt: m.membership.joinedAt.toISOString(),
    })),
    stats: {
      memberCount: members.length,
      expenseCount: Number(expenseStats?.total ?? 0),
      expenseValuePaise: Number(expenseStats?.value ?? 0),
      settlementCount: Number(settlementStats?.total ?? 0),
      settledValuePaise: Number(completed?.value ?? 0),
      pendingSettlements: Number(pending?.value ?? 0),
      activityCount: Number(activityCount?.value ?? 0),
      openDebtCount: debts.length,
      openDebtValuePaise: debts.reduce((total, debt) => total + debt.owedPaise, 0),
    },
    debts: debts.map((debt) => ({
      ...debt,
      debtorName: nameById.get(debt.debtorId) ?? 'Former member',
      creditorName: nameById.get(debt.creditorId) ?? 'Former member',
    })),
  };
};

/* -------------------------------------------------------------------------- */
/* Creator transfer                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Hands a group to a different member.
 *
 * Guarded rather than trusted: the target must already be a member and must not be the
 * current creator. Roles are swapped inside one transaction so the group can never be
 * observed with two creators or none, and the audit row is written in the same
 * transaction as the change.
 */
export const transferGroupCreator = async (input: {
  groupId: string;
  newCreatorId: string;
  actor: { id: string; email: string };
}) => {
  const groupRows = await db
    .select()
    .from(groups)
    .where(eq(groups.id, input.groupId))
    .limit(1);

  const group = groupRows[0];
  if (!group) throw notFound('Group not found.');

  if (group.createdBy === input.newCreatorId) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'They already own this group.');
  }

  const targetRows = await db
    .select({ membership: groupMembers, user: users })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(
      and(
        eq(groupMembers.groupId, input.groupId),
        eq(groupMembers.userId, input.newCreatorId),
      ),
    )
    .limit(1);

  const target = targetRows[0];
  if (!target) {
    throw badRequest(
      ERROR_CODES.VALIDATION_ERROR,
      'The new owner must already be a member of this group.',
    );
  }

  if (target.user.status === 'disabled') {
    throw badRequest(
      ERROR_CODES.VALIDATION_ERROR,
      'That account is disabled and cannot own a group.',
    );
  }

  return db.transaction(async (tx) => {
    await tx
      .update(groups)
      .set({ createdBy: input.newCreatorId, updatedAt: new Date() })
      .where(eq(groups.id, input.groupId));

    // Demote whoever currently holds creator, then promote the target. Two statements,
    // one transaction: the intermediate state is never visible to a reader.
    await tx
      .update(groupMembers)
      .set({ role: 'member' })
      .where(
        and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.role, 'creator'),
          ne(groupMembers.userId, input.newCreatorId),
        ),
      );

    await tx
      .update(groupMembers)
      .set({ role: 'creator' })
      .where(
        and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, input.newCreatorId),
        ),
      );

    await auditService.record(
      {
        actorUserId: input.actor.id,
        actorEmail: input.actor.email,
        action: auditService.AUDIT_ACTIONS.GROUP_CREATOR_TRANSFERRED,
        targetType: 'group',
        targetId: input.groupId,
        targetLabel: group.name,
        metadata: {
          previousCreatorId: group.createdBy,
          newCreatorId: input.newCreatorId,
          newCreatorEmail: target.user.email,
        },
      },
      tx,
    );

    return { groupId: input.groupId, newCreatorId: input.newCreatorId };
  });
};

/* -------------------------------------------------------------------------- */
/* Settlement context                                                         */
/* -------------------------------------------------------------------------- */

export type SettlementFilters = {
  limit: number;
  offset: number;
  groupId?: string;
  status?: string;
  search?: string;
};

/**
 * Settlements across the platform, each with the live debt between the two parties.
 *
 * The live figure is fetched from the balance engine per row rather than derived here.
 * It is what makes "₹500 recorded, ₹1,200 still outstanding" possible on the admin
 * screen without inventing a second notion of what is owed.
 */
export const listSettlements = async (filters: SettlementFilters) => {
  const payer = { id: users.id, fullName: users.fullName, email: users.email };

  const conditions: SQL[] = [];
  if (filters.groupId) conditions.push(eq(settlements.groupId, filters.groupId));
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(settlements.status, filters.status as never));
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const matches = or(ilike(groups.name, pattern), ilike(settlements.note, pattern));
    if (matches) conditions.push(matches);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      settlement: settlements,
      group: { id: groups.id, name: groups.name },
      payer,
    })
    .from(settlements)
    .innerJoin(groups, eq(groups.id, settlements.groupId))
    .innerJoin(users, eq(users.id, settlements.payerId))
    .where(where)
    .orderBy(desc(settlements.createdAt))
    .limit(filters.limit)
    .offset(filters.offset);

  // One query for the receivers on this page, rather than a join that would collide
  // with the payer join on the same table.
  const receiverIds = [...new Set(rows.map((row) => row.settlement.receiverId))];
  const receivers = receiverIds.length
    ? await db
        .select({ id: users.id, fullName: users.fullName, email: users.email })
        .from(users)
        .where(inArray(users.id, receiverIds))
    : [];

  const receiverById = new Map(receivers.map((person) => [person.id, person]));

  const withDebt = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      receiver: receiverById.get(row.settlement.receiverId) ?? null,
      // Authoritative: how much the payer still owes the receiver right now.
      outstandingPaise: await getOutstandingBetween(
        row.settlement.groupId,
        row.settlement.payerId,
        row.settlement.receiverId,
      ),
    })),
  );

  const totals = await db
    .select({ value: count() })
    .from(settlements)
    .innerJoin(groups, eq(groups.id, settlements.groupId))
    .where(where);

  return { rows: withDebt, total: Number(totals[0]?.value ?? 0) };
};

/* -------------------------------------------------------------------------- */
/* Global search                                                              */
/* -------------------------------------------------------------------------- */

/** Cross-entity lookup for the console's search bar. Read-only. */
export const globalSearch = async (term: string, limit = 5) => {
  const pattern = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

  const [userRows, groupRows, expenseRows] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(or(ilike(users.fullName, pattern), ilike(users.email, pattern)))
      .limit(limit),

    db
      .select({
        id: groups.id,
        name: groups.name,
        inviteCode: groups.inviteCode,
        status: groups.status,
      })
      .from(groups)
      .where(or(ilike(groups.name, pattern), ilike(groups.inviteCode, pattern)))
      .limit(limit),

    db
      .select({
        id: expenses.id,
        title: expenses.title,
        amountPaise: expenses.amountPaise,
        groupId: expenses.groupId,
      })
      .from(expenses)
      .where(ilike(expenses.title, pattern))
      .limit(limit),
  ]);

  return { users: userRows, groups: groupRows, expenses: expenseRows };
};
