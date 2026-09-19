import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { expenses, groups, settlements, users } from '../db/schema.js';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { loadPermissions, requirePermission } from '../middleware/requirePermission.js';
import { validateBody, validateQuery, validated, validatedQuery } from '../middleware/validate.js';
import { ERROR_CODES, badRequest, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { revokeAllSessionsForUser } from '../services/sessionService.js';
import * as adminService from '../services/adminService.js';
import * as permissionService from '../services/permissionService.js';
import * as adminOperations from '../services/adminOperationsService.js';
import * as auditService from '../services/auditService.js';
import * as groupService from '../services/groupService.js';
import * as expenseService from '../services/expenseService.js';
import * as settlementService from '../services/settlementService.js';
import { paiseToRupees } from '../utils/money.js';
import { publishToGroup } from '../realtime/socketServer.js';
import { REALTIME_EVENTS } from '../realtime/events.js';
import * as purgeService from '../services/purgeService.js';
import {
  purgeExecuteSchema,
  purgeFiltersSchema,
} from '../controllers/purgeController.js';
import { hashPassword } from '../services/passwordService.js';
import { passwordSchema } from '../validation/authSchemas.js';

/**
 * Admin console API. Mounted at /api/admin.
 *
 * Read access is broad; write access is deliberately narrow. An administrator can change
 * a role, revoke sessions and delete records, but there is no endpoint that lets them act
 * as another user or read a credential. Every mutation is logged with the acting admin.
 */
const router = Router();

/**
 * Entry to the whole console is a permission, not a role, so an administrator can hand
 * someone read access to the console without making them an administrator. Each
 * mutating route below adds its own, narrower gate on top.
 */
router.use(
  asyncHandler(loadSession),
  requireAuth,
  asyncHandler(loadPermissions),
  requirePermission('admin.access'),
);

const pageSchema = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().max(100).optional(),
};

const userQuerySchema = z
  .object({
    ...pageSchema,
    role: z.enum(['all', 'admin', 'user']).default('all'),
    verified: z.enum(['all', 'true', 'false']).default('all'),
    status: z.enum(['all', 'active', 'disabled']).default('all'),
  })
  .passthrough();

const groupQuerySchema = z
  .object({
    ...pageSchema,
    status: z.enum(['all', 'active', 'disabled']).default('all'),
  })
  .passthrough();

const expenseQuerySchema = z
  .object({
    ...pageSchema,
    groupId: z.string().uuid().optional(),
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .passthrough();

const roleSchema = z.object({ role: z.enum(['admin', 'user']) }).strict();

/* ---- Telemetry ---- */

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    sendOk(res, await adminService.getPlatformStats());
  }),
);

/* ---- Users ---- */

router.get(
  '/users',
  validateQuery(userQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, userQuerySchema);
    const { rows, total } = await adminService.listUsers({
      limit: query.limit,
      offset: query.offset,
      ...(query.search ? { search: query.search } : {}),
      ...(query.role !== 'all' ? { role: query.role } : {}),
      ...(query.verified !== 'all' ? { verified: query.verified === 'true' } : {}),
      ...(query.status !== 'all' ? { status: query.status } : {}),
    });

    sendOk(res, {
      users: rows,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + rows.length < total,
      },
    });
  }),
);

router.patch(
  '/users/:userId/role',
  validateBody(roleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    const { role } = validated(req, roleSchema);

    // An admin demoting themselves could leave the platform with no administrator.
    if (targetId === req.user!.id) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'You cannot change your own role.');
    }

    const updated = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, targetId))
      .returning({ id: users.id, email: users.email, role: users.role });

    if (!updated[0]) throw notFound('User not found.');

    logger.warn('admin.role_changed', { actorId: req.user!.id, targetId, newRole: role });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.USER_ROLE_CHANGED,
      targetType: 'user',
      targetId,
      targetLabel: updated[0].email,
      metadata: { newRole: role },
    });

    sendOk(res, { user: updated[0] });
  }),
);

/**
 * Signs a user out of every device.
 *
 * This is the safe alternative to impersonation: an admin can end a compromised
 * session without ever gaining the ability to act as that person.
 */
router.post(
  '/users/:userId/revoke-sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    await revokeAllSessionsForUser(targetId);
    logger.warn('admin.sessions_revoked', { actorId: req.user!.id, targetId });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.USER_SESSIONS_REVOKED,
      targetType: 'user',
      targetId,
    });
    sendOk(res, { revoked: true });
  }),
);

router.delete(
  '/users/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);

    if (targetId === req.user!.id) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'You cannot delete your own account here.');
    }

    // `expenses.paid_by` is ON DELETE RESTRICT, so a user who funded history cannot be
    // deleted. That is intentional: removing them would orphan financial records.
    try {
      const deleted = await db
        .delete(users)
        .where(eq(users.id, targetId))
        .returning({ id: users.id });

      if (!deleted[0]) throw notFound('User not found.');

      logger.warn('admin.user_deleted', { actorId: req.user!.id, targetId });

      await auditService.record({
        actorUserId: req.user!.id,
      actorEmail: req.user!.email,
        action: auditService.AUDIT_ACTIONS.USER_DELETED,
        targetType: 'user',
        targetId,
      });
      sendOk(res, { deleted: true });
    } catch (error: unknown) {
      const code = (error as { cause?: { code?: string } })?.cause?.code;
      if (code === '23503') {
        throw badRequest(
          ERROR_CODES.VALIDATION_ERROR,
          'This user has financial history and cannot be deleted. Revoke their sessions instead.',
        );
      }
      throw error;
    }
  }),
);

/* ---- Groups ---- */

router.get(
  '/groups',
  validateQuery(groupQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, groupQuerySchema);
    const { rows, total } = await adminService.listGroups({
      limit: query.limit,
      offset: query.offset,
      ...(query.search ? { search: query.search } : {}),
      ...(query.status !== 'all' ? { status: query.status } : {}),
    });

    sendOk(res, {
      groups: rows,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + rows.length < total,
      },
    });
  }),
);

router.delete(
  '/groups/:groupId',
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = String(req.params.groupId);
    const deleted = await db
      .delete(groups)
      .where(eq(groups.id, groupId))
      .returning({ id: groups.id, name: groups.name });

    if (!deleted[0]) throw notFound('Group not found.');

    logger.warn('admin.group_deleted', {
      actorId: req.user!.id,
      groupId,
      groupName: deleted[0].name,
    });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.GROUP_DELETED,
      targetType: 'group',
      targetId: groupId,
      targetLabel: deleted[0].name,
    });

    sendOk(res, { deleted: true });
  }),
);

/* ---- Expenses ---- */

router.get(
  '/expenses',
  validateQuery(expenseQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, expenseQuerySchema);
    const { rows, total, totalValuePaise } = await adminService.listExpenses({
      limit: query.limit,
      offset: query.offset,
      ...(query.search ? { search: query.search } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });

    sendOk(res, {
      expenses: rows,
      totalValuePaise,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + rows.length < total,
      },
    });
  }),
);

/* -------------------------------------------------------------------------- */
/* Account lifecycle                                                          */
/* -------------------------------------------------------------------------- */

const disableUserSchema = z
  .object({ reason: z.string().trim().max(200).optional() })
  .strict();

/**
 * Disables an account and ends its sessions in the same request.
 *
 * Disabling without revoking would leave the person signed in until their cookie
 * expired, which is not what "disabled" means to whoever pressed the button.
 */
router.post(
  '/users/:userId/disable',
  requirePermission('admin.users.manage'),
  validateBody(disableUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    const { reason } = validated(req, disableUserSchema);

    if (targetId === req.user!.id) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'You cannot disable your own account.');
    }

    const updated = await db
      .update(users)
      .set({
        status: 'disabled',
        disabledAt: new Date(),
        disabledReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId))
      .returning({ id: users.id, email: users.email, status: users.status });

    if (!updated[0]) throw notFound('User not found.');

    await revokeAllSessionsForUser(targetId);

    logger.warn('admin.user_disabled', { actorId: req.user!.id, targetId });

    // The reason is a description of the action, not a credential, so it is recorded.
    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.USER_DISABLED,
      targetType: 'user',
      targetId,
      targetLabel: updated[0].email,
      metadata: { reason: reason ?? null },
    });
    sendOk(res, { user: updated[0] });
  }),
);

router.post(
  '/users/:userId/enable',
  requirePermission('admin.users.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);

    const updated = await db
      .update(users)
      .set({ status: 'active', disabledAt: null, disabledReason: null, updatedAt: new Date() })
      .where(eq(users.id, targetId))
      .returning({ id: users.id, email: users.email, status: users.status });

    if (!updated[0]) throw notFound('User not found.');

    logger.warn('admin.user_enabled', { actorId: req.user!.id, targetId });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.USER_ENABLED,
      targetType: 'user',
      targetId,
      targetLabel: updated[0].email,
    });
    sendOk(res, { user: updated[0] });
  }),
);

/**
 * Sets a new password for an account.
 *
 * The plaintext is never logged and never echoed back: the administrator types it and
 * is responsible for delivering it. Every session is revoked, so an attacker holding
 * one cannot outlive the reset.
 */
const setPasswordSchema = z.object({ password: passwordSchema }).strict();

router.post(
  '/users/:userId/password',
  requirePermission('admin.users.manage'),
  validateBody(setPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    const { password } = validated(req, setPasswordSchema);

    const target = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!target[0]) throw notFound('User not found.');

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(users.id, targetId));

    await revokeAllSessionsForUser(targetId);

    // Records that it happened, never what was set. The audit row carries no
    // metadata at all here: there is nothing about a password worth keeping.
    logger.warn('admin.password_reset', { actorId: req.user!.id, targetId });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.USER_PASSWORD_RESET,
      targetType: 'user',
      targetId,
    });
    sendOk(res, { updated: true });
  }),
);

/* ---- Group lifecycle ---- */

router.post(
  '/groups/:groupId/disable',
  requirePermission('admin.groups.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = String(req.params.groupId);

    const updated = await db
      .update(groups)
      .set({ status: 'disabled', disabledAt: new Date(), updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning({ id: groups.id, name: groups.name, status: groups.status });

    if (!updated[0]) throw notFound('Group not found.');

    logger.warn('admin.group_disabled', { actorId: req.user!.id, groupId });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.GROUP_DISABLED,
      targetType: 'group',
      targetId: groupId,
      targetLabel: updated[0].name,
    });
    sendOk(res, { group: updated[0] });
  }),
);

router.post(
  '/groups/:groupId/enable',
  requirePermission('admin.groups.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = String(req.params.groupId);

    const updated = await db
      .update(groups)
      .set({ status: 'active', disabledAt: null, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning({ id: groups.id, name: groups.name, status: groups.status });

    if (!updated[0]) throw notFound('Group not found.');

    logger.warn('admin.group_enabled', { actorId: req.user!.id, groupId });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.GROUP_ENABLED,
      targetType: 'group',
      targetId: groupId,
      targetLabel: updated[0].name,
    });
    sendOk(res, { group: updated[0] });
  }),
);

/* -------------------------------------------------------------------------- */
/* Permissions                                                                */
/* -------------------------------------------------------------------------- */

/** The registry itself, so the admin UI renders the server's list rather than its own. */
router.get(
  '/permissions',
  asyncHandler(async (_req: Request, res: Response) => {
    sendOk(res, { permissions: permissionService.describeRegistry() });
  }),
);

router.get(
  '/users/:userId/permissions',
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    const [effective, overrides, scope] = await Promise.all([
      permissionService.getEffectivePermissions(targetId),
      permissionService.listOverrides(targetId),
      permissionService.getDashboardScope(targetId),
    ]);

    sendOk(res, {
      role: effective.role,
      permissions: effective.permissions,
      overrides,
      dashboardScope: scope,
      registry: permissionService.describeRegistry(),
    });
  }),
);

const permissionChangeSchema = z
  .object({
    changes: z
      .array(
        z.object({
          permission: z.string().trim().min(1),
          /** `null` clears the override, returning the user to the registry default. */
          effect: z.enum(['allow', 'deny']).nullable(),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

router.patch(
  '/users/:userId/permissions',
  requirePermission('admin.permissions.manage'),
  validateBody(permissionChangeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    const { changes } = validated(req, permissionChangeSchema);

    await permissionService.setPermissions({
      userId: targetId,
      changes,
      actorUserId: req.user!.id,
    });

    // Permissions resolve per request, so a revocation takes effect on their very next
    // call rather than at next sign-in. Nothing further is needed here.
    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.PERMISSIONS_CHANGED,
      targetType: 'user',
      targetId,
      metadata: { changes },
    });

    sendOk(res, await permissionService.getEffectivePermissions(targetId));
  }),
);

/* ---- Spending dashboard scope ---- */

const dashboardScopeSchema = z
  .object({
    scope: z.enum(['all_groups', 'selected_groups']),
    groupIds: z.array(z.string().uuid()).max(500).default([]),
  })
  .strict()
  .refine((data) => data.scope === 'all_groups' || data.groupIds.length > 0, {
    path: ['groupIds'],
    message: 'Choose at least one group, or grant access to all groups',
  });

router.put(
  '/users/:userId/dashboard-scope',
  requirePermission('admin.permissions.manage'),
  validateBody(dashboardScopeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    const { scope, groupIds } = validated(req, dashboardScopeSchema);

    await permissionService.setDashboardScope({
      userId: targetId,
      scope,
      groupIds,
      actorUserId: req.user!.id,
    });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.DASHBOARD_SCOPE_CHANGED,
      targetType: 'user',
      targetId,
      metadata: { scope, groupCount: groupIds.length },
    });

    sendOk(res, { scope: await permissionService.getDashboardScope(targetId) });
  }),
);

router.delete(
  '/users/:userId/dashboard-scope',
  requirePermission('admin.permissions.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const targetId = String(req.params.userId);
    await permissionService.clearDashboardScope(targetId);
    logger.warn('dashboard_scope.cleared', { actorId: req.user!.id, targetId });

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.DASHBOARD_SCOPE_CLEARED,
      targetType: 'user',
      targetId,
    });
    sendOk(res, { cleared: true });
  }),
);

/* ---- History purge ---- */

/*
 * The group-scoped purge routes are creator-only, which leaves an admin unable to act
 * when an owner is unavailable. These two give an admin the same operation without a
 * second implementation of it: the filters are validated by the same schemas, the work
 * is done by the same purgeService, and the balance-safety refusal lives inside that
 * service. So the admin route waives *who may ask*, and waives nothing about what the
 * domain permits -- a range that would move a balance is refused here exactly as it is
 * for the group's own creator.
 *
 * 'history.purge' is required on top of 'admin.groups.manage': holding the console is
 * not by itself permission to destroy financial history.
 */

const adminPurgeTarget = async (groupId: string) => {
  const rows = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  const group = rows[0];
  if (!group) throw notFound('Group not found.');
  return group;
};

router.post(
  '/groups/:groupId/purge/preview',
  requirePermission('admin.groups.manage'),
  requirePermission('history.purge'),
  validateBody(purgeFiltersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const group = await adminPurgeTarget(String(req.params.groupId));
    const input = validated(req, purgeFiltersSchema);

    const preview = await purgeService.previewPurge({
      // The proven group from the path, never a groupId smuggled in the body.
      groupId: group.id,
      from: input.from,
      to: input.to,
      ...(input.memberId ? { memberId: input.memberId } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.paymentMode ? { paymentMode: input.paymentMode } : {}),
      includeActivities: input.includeActivities,
    });

    sendOk(res, {
      ...preview,
      amount: paiseToRupees(preview.amountPaise),
      blockingDebts: preview.blockingDebts.map((debt) => ({
        ...debt,
        owed: paiseToRupees(debt.owedPaise),
      })),
    });
  }),
);

router.post(
  '/groups/:groupId/purge',
  requirePermission('admin.groups.manage'),
  requirePermission('history.purge'),
  validateBody(purgeExecuteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const group = await adminPurgeTarget(String(req.params.groupId));
    const input = validated(req, purgeExecuteSchema);

    if (input.confirmation.trim() !== group.name.trim()) {
      throw badRequest(
        ERROR_CODES.VALIDATION_ERROR,
        'Type the group name exactly to confirm this purge.',
      );
    }

    // purgeService re-checks safety immediately before deleting and writes its own
    // immutable audit row inside the same transaction as the deletion.
    const result = await purgeService.executePurge(
      {
        groupId: group.id,
        from: input.from,
        to: input.to,
        ...(input.memberId ? { memberId: input.memberId } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.paymentMode ? { paymentMode: input.paymentMode } : {}),
        includeActivities: input.includeActivities,
      },
      { id: req.user!.id, email: req.user!.email },
    );

    logger.warn('admin.history_purged', {
      actorId: req.user!.id,
      groupId: group.id,
      expensesDeleted: result.expensesDeleted,
      settlementsDeleted: result.settlementsDeleted,
    });

    // Members looking at the group need it to stop showing rows that no longer exist.
    publishToGroup({
      event: REALTIME_EVENTS.GROUP_UPDATED,
      groupId: group.id,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      message: 'An administrator cleared part of this group’s history',
    });

    sendOk(res, { ...result, amount: paiseToRupees(result.amountPaise) });
  }),
);

/* ---- Purge audit trail (read-only, platform-wide) ---- */

router.get(
  '/purge-audits',
  validateQuery(groupQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, groupQuerySchema);
    const { rows, total } = await purgeService.listPurgeAudits({
      limit: query.limit,
      offset: query.offset,
    });
    sendOk(res, { audits: rows, total });
  }),
);

/* -------------------------------------------------------------------------- */
/* Group detail and operations                                                */
/* -------------------------------------------------------------------------- */

router.get(
  '/groups/:groupId',
  asyncHandler(async (req: Request, res: Response) => {
    const detail = await adminOperations.getGroupDetail(String(req.params.groupId));

    sendOk(res, {
      group: {
        id: detail.group.id,
        name: detail.group.name,
        description: detail.group.description,
        inviteCode: detail.group.inviteCode,
        status: detail.group.status,
        disabledAt: detail.group.disabledAt?.toISOString() ?? null,
        payday: detail.group.payday,
        createdAt: detail.group.createdAt.toISOString(),
      },
      creator: detail.creator,
      members: detail.members,
      stats: { ...detail.stats, expenseValue: paiseToRupees(detail.stats.expenseValuePaise) },
      debts: detail.debts.map((debt) => ({ ...debt, owed: paiseToRupees(debt.owedPaise) })),
    });
  }),
);

const transferSchema = z.object({ newCreatorId: z.string().uuid() }).strict();

/**
 * Hands the group to another member.
 *
 * Membership and account status are re-proven in the service; this route only carries
 * the capability check. The audit row is written inside the same transaction.
 */
router.post(
  '/groups/:groupId/transfer-creator',
  requirePermission('admin.groups.manage'),
  validateBody(transferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { newCreatorId } = validated(req, transferSchema);

    const result = await adminOperations.transferGroupCreator({
      groupId: String(req.params.groupId),
      newCreatorId,
      actor: { id: req.user!.id, email: req.user!.email },
    });

    publishToGroup({
      event: REALTIME_EVENTS.GROUP_UPDATED,
      groupId: result.groupId,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      message: 'Group ownership was transferred by an administrator',
    });

    sendOk(res, result);
  }),
);

/**
 * Removes a member on an administrator's behalf.
 *
 * Delegates to the same group service the members' own UI uses, so the outstanding
 * balance guard applies identically: an administrator cannot remove someone who still
 * owes or is owed money, because that would orphan a debt.
 */
router.delete(
  '/groups/:groupId/members/:userId',
  requirePermission('admin.groups.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const groupId = String(req.params.groupId);
    const targetId = String(req.params.userId);

    const detail = await adminOperations.getGroupDetail(groupId);
    const target = detail.members.find((member) => member.id === targetId);
    if (!target) throw notFound('That person is not a member of this group.');

    await groupService.removeMember(groupId, detail.group.createdBy, targetId);

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.GROUP_MEMBER_REMOVED,
      targetType: 'group',
      targetId: groupId,
      targetLabel: detail.group.name,
      metadata: { removedUserId: targetId, removedEmail: target.email },
    });

    publishToGroup({
      event: REALTIME_EVENTS.MEMBER_REMOVED,
      groupId,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      entityId: targetId,
      message: 'A member was removed by an administrator',
    });

    sendOk(res, { removed: true });
  }),
);

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Deletes any expense.
 *
 * Routed through the ordinary expense service with `bypassOwnership`, which waives the
 * "only the payer may delete" AUTHORISATION rule and nothing else. Participant rows
 * still cascade and balances are still derived from what remains, so the financial
 * invariants are untouched.
 */
router.delete(
  '/expenses/:expenseId',
  requirePermission('admin.groups.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const expenseId = String(req.params.expenseId);

    const rows = await db
      .select({ expense: expenses, group: { id: groups.id, name: groups.name } })
      .from(expenses)
      .innerJoin(groups, eq(groups.id, expenses.groupId))
      .where(eq(expenses.id, expenseId))
      .limit(1);

    const found = rows[0];
    if (!found) throw notFound('Expense not found.');

    const result = await expenseService.deleteExpense(
      expenseId,
      found.expense.groupId,
      req.user!.id,
      { bypassOwnership: true },
    );

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.EXPENSE_DELETED,
      targetType: 'expense',
      targetId: expenseId,
      targetLabel: result.deleted.title,
      metadata: {
        groupId: found.expense.groupId,
        groupName: found.group.name,
        amountPaise: result.deleted.amountPaise,
        paidBy: result.deleted.paidBy,
      },
    });

    publishToGroup({
      event: REALTIME_EVENTS.EXPENSE_DELETED,
      groupId: found.expense.groupId,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      entityId: expenseId,
      message: `An administrator deleted "${result.deleted.title}"`,
    });

    sendOk(res, { deleted: true, expenseId });
  }),
);

/* -------------------------------------------------------------------------- */
/* Settlements                                                                */
/* -------------------------------------------------------------------------- */

const settlementQuerySchema = z
  .object({
    ...pageSchema,
    groupId: z.string().uuid().optional(),
    status: z
      .enum([
        'all',
        'paid_pending_approval',
        'will_pay_soon',
        'completed',
        'rejected',
        'cancelled',
      ])
      .default('all'),
  })
  .passthrough();

/**
 * Settlements across the platform, each carrying the live outstanding debt between the
 * two parties. The debt figure comes from the balance engine, never from arithmetic here.
 */
router.get(
  '/settlements',
  validateQuery(settlementQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, settlementQuerySchema);

    const { rows, total } = await adminOperations.listSettlements({
      limit: query.limit,
      offset: query.offset,
      ...(query.search ? { search: query.search } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      status: query.status,
    });

    sendOk(res, {
      settlements: rows.map((row) => ({
        id: row.settlement.id,
        group: row.group,
        payer: row.payer,
        receiver: row.receiver,
        amountPaise: row.settlement.amountPaise,
        amount: paiseToRupees(row.settlement.amountPaise),
        status: row.settlement.status,
        paymentMethod: row.settlement.paymentMethod,
        hasProof: Boolean(row.settlement.proofUrl),
        note: row.settlement.note,
        paidAt: row.settlement.paidAt.toISOString(),
        createdAt: row.settlement.createdAt.toISOString(),
        outstandingPaise: row.outstandingPaise,
        outstanding: paiseToRupees(row.outstandingPaise),
      })),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + rows.length < total,
      },
    });
  }),
);

/**
 * Cancels a settlement on an administrator's behalf.
 *
 * Goes through the settlement service with `bypassParticipantCheck`, so the status
 * transition and its guards are exactly the ones the members' own flow uses. Only the
 * "you must be party to this" authorisation check is waived.
 */
router.post(
  '/settlements/:settlementId/cancel',
  requirePermission('admin.groups.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const settlementId = String(req.params.settlementId);

    const rows = await db
      .select({ settlement: settlements, group: { id: groups.id, name: groups.name } })
      .from(settlements)
      .innerJoin(groups, eq(groups.id, settlements.groupId))
      .where(eq(settlements.id, settlementId))
      .limit(1);

    const found = rows[0];
    if (!found) throw notFound('Settlement not found.');

    const cancelled = await settlementService.cancelSettlement(
      settlementId,
      found.settlement.groupId,
      req.user!.id,
      { bypassParticipantCheck: true },
    );

    await auditService.record({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: auditService.AUDIT_ACTIONS.SETTLEMENT_CANCELLED,
      targetType: 'settlement',
      targetId: settlementId,
      targetLabel: `${found.group.name} settlement`,
      metadata: {
        groupId: found.settlement.groupId,
        amountPaise: found.settlement.amountPaise,
        previousStatus: found.settlement.status,
      },
    });

    publishToGroup({
      event: REALTIME_EVENTS.SETTLEMENT_CANCELLED,
      groupId: found.settlement.groupId,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      entityId: settlementId,
      message: 'An administrator cancelled a settlement',
    });

    sendOk(res, { settlement: { id: cancelled.id, status: cancelled.status } });
  }),
);

/* -------------------------------------------------------------------------- */
/* Activity, audit and search                                                 */
/* -------------------------------------------------------------------------- */

const activityQuerySchema = z
  .object({
    ...pageSchema,
    groupId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    type: z.string().trim().max(60).optional(),
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .passthrough();

router.get(
  '/activity',
  validateQuery(activityQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, activityQuerySchema);

    const { rows, total } = await adminService.listActivity({
      limit: query.limit,
      offset: query.offset,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.search ? { search: query.search } : {}),
    });

    sendOk(res, {
      activities: rows,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + rows.length < total,
      },
    });
  }),
);

const auditQuerySchema = z
  .object({
    ...pageSchema,
    action: z.string().trim().max(80).optional(),
    actorId: z.string().uuid().optional(),
    targetType: z.string().trim().max(40).optional(),
    targetId: z.string().uuid().optional(),
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .passthrough();

/** Read-only. There is no endpoint anywhere that mutates or removes an audit row. */
router.get(
  '/audit',
  validateQuery(auditQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, auditQuerySchema);

    const { rows, total } = await auditService.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.search ? { search: query.search } : {}),
    });

    sendOk(res, {
      audits: rows.map((row) => ({
        id: row.audit.id,
        action: row.audit.action,
        actor: row.actor,
        actorEmail: row.audit.actorEmail,
        targetType: row.audit.targetType,
        targetId: row.audit.targetId,
        targetLabel: row.audit.targetLabel,
        metadata: row.audit.metadata,
        createdAt: row.audit.createdAt.toISOString(),
      })),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + rows.length < total,
      },
    });
  }),
);

router.get(
  '/audit/actions',
  asyncHandler(async (_req: Request, res: Response) => {
    sendOk(res, { actions: await auditService.listActions() });
  }),
);

const searchSchema = z.object({ q: z.string().trim().min(1).max(100) }).passthrough();

router.get(
  '/search',
  validateQuery(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = validatedQuery(req, searchSchema);
    sendOk(res, await adminOperations.globalSearch(q));
  }),
);

export default router;
