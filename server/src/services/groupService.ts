import { and, asc, desc, eq, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  activities,
  groupMembers,
  groups,
  users,
  type Group,
  type GroupMember,
} from '../db/schema.js';
import { ERROR_CODES, conflict, badRequest, notFound } from '../utils/errors.js';
import { isUniqueViolation } from '../utils/dbErrors.js';
import {
  generateInviteCode,
  generateInviteToken,
  normalizeInviteCode,
} from './inviteCodeService.js';
import { hasSettledAllDebts } from './balanceService.js';

/** How many times to retry when a freshly generated code loses a uniqueness race. */
const MAX_CODE_ATTEMPTS = 8;

export type CreateGroupInput = {
  name: string;
  description?: string | null;
  userId: string;
};

/**
 * Creates a group, its creator membership and its audit entry as ONE transaction.
 *
 * A failure at any point rolls everything back, so there is no window in which an
 * orphan group exists holding a unique invite code nobody can reach.
 *
 * Invite-code uniqueness is enforced by the database, not by a pre-flight SELECT.
 * A pre-check is inherently racy: two concurrent requests can both see a code as free.
 * Here the UNIQUE index decides the winner and the loser simply retries with a new code.
 */
export const createGroup = async (input: CreateGroupInput): Promise<{
  group: Group;
  membership: GroupMember;
}> => {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const inviteCode = generateInviteCode();
    const inviteToken = generateInviteToken();

    try {
      return await db.transaction(async (tx) => {
        const insertedGroups = await tx
          .insert(groups)
          .values({
            name: input.name,
            description: input.description ?? null,
            inviteCode,
            inviteToken,
            createdBy: input.userId,
          })
          .returning();

        const group = insertedGroups[0]!;

        const insertedMembers = await tx
          .insert(groupMembers)
          .values({ groupId: group.id, userId: input.userId, role: 'creator' })
          .returning();

        await tx.insert(activities).values({
          groupId: group.id,
          actorUserId: input.userId,
          type: 'group_created',
          entityType: 'group',
          entityId: group.id,
          metadata: { groupName: group.name },
        });

        return { group, membership: insertedMembers[0]! };
      });
    } catch (error: unknown) {
      // Only a code/token collision is retryable; anything else is a real failure.
      if (
        isUniqueViolation(error, 'groups_invite_code_unique') ||
        isUniqueViolation(error, 'groups_invite_token_unique')
      ) {
        continue;
      }
      throw error;
    }
  }

  throw conflict(
    ERROR_CODES.INTERNAL_ERROR,
    'Could not allocate a unique invite code. Please try again.',
  );
};

/**
 * Resolves an invite by opaque token first, then by human code.
 *
 * Token is checked first and matched case-sensitively so a 6-character code can never
 * accidentally satisfy a token lookup.
 */
export const findGroupByInvite = async (raw: string): Promise<Group | undefined> => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const byToken = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteToken, trimmed))
    .limit(1);
  if (byToken[0]) return byToken[0];

  const normalized = normalizeInviteCode(trimmed);
  if (!normalized) return undefined;

  const byCode = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, normalized))
    .limit(1);
  return byCode[0];
};

export type JoinResult = { group: Group; membership: GroupMember; alreadyMember: boolean };

/**
 * Joins a group by code or token.
 *
 * Multi-group is allowed, so the only membership restriction is that a user cannot join
 * the same group twice. That is guaranteed by the UNIQUE(group_id, user_id) index rather
 * than by a check-then-insert, which two concurrent requests could both pass.
 */
export const joinGroupByInvite = async (
  invite: string,
  userId: string,
): Promise<JoinResult> => {
  const group = await findGroupByInvite(invite);
  if (!group) {
    throw notFound('That invite is not valid or has been revoked.', ERROR_CODES.INVITE_INVALID);
  }

  const existing = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
    .limit(1);

  if (existing[0]) {
    return { group, membership: existing[0], alreadyMember: true };
  }

  try {
    const membership = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(groupMembers)
        .values({ groupId: group.id, userId, role: 'member' })
        .returning();

      await tx.insert(activities).values({
        groupId: group.id,
        actorUserId: userId,
        type: 'member_joined',
        entityType: 'group',
        entityId: group.id,
        metadata: {},
      });

      return inserted[0]!;
    });

    return { group, membership, alreadyMember: false };
  } catch (error: unknown) {
    if (isUniqueViolation(error, 'group_members_group_user_unique')) {
      // Lost a concurrent-join race; the outcome the caller wanted is still true.
      const row = await db
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
        .limit(1);
      if (row[0]) return { group, membership: row[0], alreadyMember: true };
    }
    throw error;
  }
};

/** Every group the user belongs to, newest membership first. */
export const listUserGroups = async (userId: string) => {
  const rows = await db
    .select({
      group: groups,
      membership: groupMembers,
      memberCount: sql<number>`(
        select count(*)::int from group_members gm where gm.group_id = ${groups.id}
      )`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(desc(groupMembers.joinedAt));

  return rows;
};

/** Members of a group with their user records, creators first then join order. */
export const listGroupMembers = async (groupId: string) => {
  return db
    .select({ membership: groupMembers, user: users })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));
};

/**
 * Rotates both the invite code and the share token.
 *
 * Regenerating deliberately invalidates every previously shared link and QR code, which
 * is the entire point: it is the group's revocation mechanism.
 */
export const regenerateInvite = async (
  groupId: string,
  actorUserId: string,
): Promise<Group> => {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const updated = await tx
          .update(groups)
          .set({
            inviteCode: generateInviteCode(),
            inviteToken: generateInviteToken(),
            inviteRotatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(groups.id, groupId))
          .returning();

        await tx.insert(activities).values({
          groupId,
          actorUserId,
          type: 'invite_regenerated',
          entityType: 'group',
          entityId: groupId,
          metadata: {},
        });

        return updated[0]!;
      });
    } catch (error: unknown) {
      if (
        isUniqueViolation(error, 'groups_invite_code_unique') ||
        isUniqueViolation(error, 'groups_invite_token_unique')
      ) {
        continue;
      }
      throw error;
    }
  }

  throw conflict(
    ERROR_CODES.INTERNAL_ERROR,
    'Could not allocate a unique invite code. Please try again.',
  );
};

/**
 * Removes the caller from a group.
 *
 * The outstanding-balance guard is computed by the balance engine server-side; a client
 * claiming to be settled is never believed. If the departing member is the creator, the
 * role transfers to the longest-standing remaining member (the reference picked an
 * arbitrary row, which made the new creator effectively random). The last member out
 * deletes the group.
 */
export const leaveGroup = async (
  groupId: string,
  userId: string,
): Promise<{ groupDeleted: boolean; newCreatorId: string | null }> => {
  const { settled, summary } = await hasSettledAllDebts(groupId, userId);

  if (!settled) {
    throw badRequest(
      ERROR_CODES.OUTSTANDING_BALANCE,
      'Settle your outstanding balances before leaving this group.',
      {
        youNeedToPayPaise: summary.youNeedToPayTotalPaise,
        youWillReceivePaise: summary.youWillReceiveTotalPaise,
      },
    );
  }

  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .returning();

    const departing = removed[0];
    if (!departing) throw notFound('You are not a member of this group.');

    const remaining = await tx
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt));

    if (remaining.length === 0) {
      // Last member out: the group and its cascade of records go with them.
      await tx.delete(groups).where(eq(groups.id, groupId));
      return { groupDeleted: true, newCreatorId: null };
    }

    let newCreatorId: string | null = null;
    if (departing.role === 'creator') {
      const successor = remaining[0]!;
      await tx
        .update(groupMembers)
        .set({ role: 'creator' })
        .where(eq(groupMembers.id, successor.id));
      newCreatorId = successor.userId;
    }

    await tx.insert(activities).values({
      groupId,
      actorUserId: userId,
      type: 'member_left',
      entityType: 'group',
      entityId: groupId,
      metadata: newCreatorId ? { creatorTransferredTo: newCreatorId } : {},
    });

    return { groupDeleted: false, newCreatorId };
  });
};

/**
 * Creator removes another member. The same settled-balance rule applies to the member
 * being removed, so a group cannot be left holding dangling obligations.
 */
export const removeMember = async (
  groupId: string,
  actorUserId: string,
  targetUserId: string,
): Promise<void> => {
  if (actorUserId === targetUserId) {
    throw badRequest(
      ERROR_CODES.VALIDATION_ERROR,
      'Use "leave group" to remove yourself.',
    );
  }

  const { settled, summary } = await hasSettledAllDebts(groupId, targetUserId);
  if (!settled) {
    throw badRequest(
      ERROR_CODES.OUTSTANDING_BALANCE,
      'That member still has unsettled balances in this group.',
      {
        theyNeedToPayPaise: summary.youNeedToPayTotalPaise,
        theyWillReceivePaise: summary.youWillReceiveTotalPaise,
      },
    );
  }

  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, targetUserId),
          // A creator cannot be removed by anyone; they must hand over or leave.
          ne(groupMembers.role, 'creator'),
        ),
      )
      .returning();

    if (!removed[0]) {
      throw notFound('That member is not in this group, or cannot be removed.');
    }

    await tx.insert(activities).values({
      groupId,
      actorUserId,
      type: 'member_removed',
      entityType: 'user',
      entityId: targetUserId,
      metadata: {},
    });
  });
};

/** Creator-only: sets or clears the monthly billing-cycle day. */
export const setPayday = async (
  groupId: string,
  actorUserId: string,
  payday: number | null,
): Promise<Group> =>
  db.transaction(async (tx) => {
    const updated = await tx
      .update(groups)
      .set({ payday, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning();

    await tx.insert(activities).values({
      groupId,
      actorUserId,
      type: 'payday_updated',
      entityType: 'group',
      entityId: groupId,
      metadata: { payday },
    });

    return updated[0]!;
  });

/** Creator-only hard delete. Cascades remove members, expenses, settlements, activity. */
export const deleteGroup = async (groupId: string): Promise<void> => {
  await db.delete(groups).where(eq(groups.id, groupId));
};

/** Public-safe invite preview: never exposes the token to a non-member. */
export const getInvitePreview = async (invite: string, viewerId?: string) => {
  const group = await findGroupByInvite(invite);
  if (!group) {
    throw notFound('That invite is not valid or has been revoked.', ERROR_CODES.INVITE_INVALID);
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id));

  let isAlreadyMember = false;
  if (viewerId) {
    const membership = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, viewerId)))
      .limit(1);
    isAlreadyMember = Boolean(membership[0]);
  }

  return {
    groupId: group.id,
    groupName: group.name,
    description: group.description,
    memberCount: countRows[0]?.count ?? 0,
    isAlreadyMember,
  };
};

export { or };
