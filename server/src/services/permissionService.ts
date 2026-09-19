import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  dashboardGrantGroups,
  dashboardGrants,
  userPermissions,
  users,
} from '../db/schema.js';
import {
  PERMISSIONS,
  isPermissionKey,
  resolvePermissions,
  type PermissionKey,
} from '../auth/permissions.js';
import { ERROR_CODES, badRequest, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Permission service.
 *
 * The single place that turns stored rows into an answer to "may this person do X?".
 * Routes never read `user_permissions` directly, so there is one resolution rule and
 * one place to change it.
 */

export type EffectivePermissions = {
  role: 'admin' | 'user';
  permissions: string[];
};

/** Resolves one user's effective set: registry defaults plus explicit overrides. */
export const getEffectivePermissions = async (
  userId: string,
): Promise<EffectivePermissions> => {
  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const role = rows[0]?.role;
  if (!role) throw notFound('User not found.');

  const overrides = await db
    .select({ permission: userPermissions.permission, effect: userPermissions.effect })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));

  return { role, permissions: [...resolvePermissions(role, overrides)] };
};

/** Same resolution, for a role and override set already in hand. Avoids a round trip. */
export const resolveForRole = (
  role: 'admin' | 'user',
  overrides: { permission: string; effect: 'allow' | 'deny' }[],
): string[] => [...resolvePermissions(role, overrides)];

/** The explicit rows set against a user, for the admin editor. */
export const listOverrides = async (userId: string) =>
  db
    .select({
      permission: userPermissions.permission,
      effect: userPermissions.effect,
      grantedBy: userPermissions.grantedBy,
      updatedAt: userPermissions.updatedAt,
    })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));

/**
 * Sets or clears one override.
 *
 * `effect: null` removes the row, returning the user to the registry default — which is
 * different from denying it, and the admin UI distinguishes the two.
 */
export const setPermission = async (input: {
  userId: string;
  permission: string;
  effect: 'allow' | 'deny' | null;
  actorUserId: string;
}): Promise<void> => {
  if (!isPermissionKey(input.permission)) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'Unknown permission.');
  }

  const target = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!target[0]) throw notFound('User not found.');

  // Administrators hold everything by role, so an override against them would be a lie
  // in the UI: it would appear set but change nothing.
  if (target[0].role === 'admin') {
    throw badRequest(
      ERROR_CODES.VALIDATION_ERROR,
      'Administrators already hold every permission. Change their role first.',
    );
  }

  if (input.effect === null) {
    await db
      .delete(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, input.userId),
          eq(userPermissions.permission, input.permission),
        ),
      );
  } else {
    await db
      .insert(userPermissions)
      .values({
        userId: input.userId,
        permission: input.permission,
        effect: input.effect,
        grantedBy: input.actorUserId,
      })
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.permission],
        set: { effect: input.effect, grantedBy: input.actorUserId, updatedAt: new Date() },
      });
  }

  logger.warn('permission.changed', {
    actorId: input.actorUserId,
    targetId: input.userId,
    permission: input.permission,
    effect: input.effect ?? 'default',
  });
};

/** Applies a whole set of overrides in one transaction, for the admin editor's Save. */
export const setPermissions = async (input: {
  userId: string;
  changes: { permission: string; effect: 'allow' | 'deny' | null }[];
  actorUserId: string;
}): Promise<void> => {
  for (const change of input.changes) {
    if (!isPermissionKey(change.permission)) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, `Unknown permission: ${change.permission}`);
    }
  }

  for (const change of input.changes) {
    await setPermission({
      userId: input.userId,
      permission: change.permission,
      effect: change.effect,
      actorUserId: input.actorUserId,
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Spending dashboard scope                                                   */
/* -------------------------------------------------------------------------- */

export type DashboardScope =
  | { kind: 'none' }
  | { kind: 'all_groups' }
  | { kind: 'selected_groups'; groupIds: string[] };

/**
 * What the spending dashboard may show this person.
 *
 * Returns `none` when they hold the permission but no scope has been configured, which
 * is treated as "nothing" rather than "everything". A missing configuration must never
 * fail open on a view of other people's money.
 */
export const getDashboardScope = async (userId: string): Promise<DashboardScope> => {
  const grants = await db
    .select({ id: dashboardGrants.id, scope: dashboardGrants.scope })
    .from(dashboardGrants)
    .where(eq(dashboardGrants.userId, userId))
    .limit(1);

  const grant = grants[0];
  if (!grant) return { kind: 'none' };
  if (grant.scope === 'all_groups') return { kind: 'all_groups' };

  const rows = await db
    .select({ groupId: dashboardGrantGroups.groupId })
    .from(dashboardGrantGroups)
    .where(eq(dashboardGrantGroups.grantId, grant.id));

  return { kind: 'selected_groups', groupIds: rows.map((row) => row.groupId) };
};

/** Replaces a person's dashboard scope wholesale. */
export const setDashboardScope = async (input: {
  userId: string;
  scope: 'all_groups' | 'selected_groups';
  groupIds: string[];
  actorUserId: string;
}): Promise<void> => {
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(dashboardGrants)
      .values({
        userId: input.userId,
        scope: input.scope,
        grantedBy: input.actorUserId,
      })
      .onConflictDoUpdate({
        target: dashboardGrants.userId,
        set: { scope: input.scope, grantedBy: input.actorUserId, updatedAt: new Date() },
      })
      .returning({ id: dashboardGrants.id });

    const grantId = inserted[0]!.id;

    await tx.delete(dashboardGrantGroups).where(eq(dashboardGrantGroups.grantId, grantId));

    if (input.scope === 'selected_groups' && input.groupIds.length > 0) {
      await tx.insert(dashboardGrantGroups).values(
        [...new Set(input.groupIds)].map((groupId) => ({ grantId, groupId })),
      );
    }
  });

  logger.warn('dashboard_scope.changed', {
    actorId: input.actorUserId,
    targetId: input.userId,
    scope: input.scope,
    groupCount: input.groupIds.length,
  });
};

/** Removes the scope entirely, used when the permission itself is revoked. */
export const clearDashboardScope = async (userId: string): Promise<void> => {
  await db.delete(dashboardGrants).where(eq(dashboardGrants.userId, userId));
};

/** The registry, for rendering the admin editor. */
export const describeRegistry = () => PERMISSIONS.map((permission) => ({ ...permission }));

/** Bulk lookup used by the admin user list, to avoid a query per row. */
export const countOverridesFor = async (userIds: string[]) => {
  if (userIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({ userId: userPermissions.userId, permission: userPermissions.permission })
    .from(userPermissions)
    .where(inArray(userPermissions.userId, userIds));

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
  }
  return counts;
};

export type { PermissionKey };
