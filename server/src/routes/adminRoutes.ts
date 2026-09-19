import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { groups, users } from '../db/schema.js';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { loadPermissions, requirePermission } from '../middleware/requirePermission.js';
import { validateBody, validateQuery, validated, validatedQuery } from '../middleware/validate.js';
import { ERROR_CODES, badRequest, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { revokeAllSessionsForUser } from '../services/sessionService.js';
import * as adminService from '../services/adminService.js';
import * as permissionService from '../services/permissionService.js';
import * as purgeService from '../services/purgeService.js';
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
  })
  .passthrough();

const groupQuerySchema = z.object(pageSchema).passthrough();

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

    logger.warn('admin.role_changed', {
      actorId: req.user!.id,
      targetId,
      newRole: role,
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

    // Records that it happened, never what was set.
    logger.warn('admin.password_reset', { actorId: req.user!.id, targetId });
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
    sendOk(res, { cleared: true });
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

export default router;
