import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { loadPermissions, requirePermission } from '../middleware/requirePermission.js';
import {
  executePurge,
  listPurgeAudits,
  previewPurge as previewPurgeHandler,
  purgeExecuteSchema,
  purgeFiltersSchema,
} from '../controllers/purgeController.js';
import { requireGroupCreator, requireGroupMember } from '../middleware/requireGroupMember.js';
import {
  createGroup,
  deleteGroup,
  getGroup,
  getShareInfo,
  joinGroup,
  leaveGroup,
  listActivities,
  listMyGroups,
  remindMember,
  previewInvite,
  regenerateInvite,
  removeMember,
  setPayday,
  updateGroup,
} from '../controllers/groupController.js';
import {
  createGroupSchema,
  joinGroupSchema,
  setPaydaySchema,
  updateGroupSchema,
  listActivitiesQuerySchema,
} from '../validation/groupSchemas.js';
import expenseRoutes from './expenseRoutes.js';
import settlementRoutes from './settlementRoutes.js';
import reportRoutes from './reportRoutes.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const router = Router();

/**
 * Invite preview is the one route that tolerates an anonymous caller, so someone
 * following a shared link can see what they are joining before creating an account.
 * `loadSession` (not `requireAuth`) lets it additionally report "you are already a
 * member" when the visitor happens to be signed in.
 *
 * Rate limited harder than the rest: it is the only endpoint where an unauthenticated
 * client can probe invite values, so it doubles as the brute-force surface for codes.
 */
router.get(
  '/invite/:invite/preview',
  rateLimit({
    name: 'invite_preview:ip',
    max: 30,
    windowMs: 15 * MINUTE,
    message: 'Too many invite lookups. Please try again shortly.',
  }),
  asyncHandler(loadSession),
  asyncHandler(previewInvite),
);

// Everything below requires a signed-in user.
router.use(asyncHandler(loadSession), requireAuth, asyncHandler(loadPermissions));

router.post(
  '/',
  requirePermission('groups.create'),
  rateLimit({ name: 'group_create:ip', max: 20, windowMs: HOUR }),
  validateBody(createGroupSchema),
  asyncHandler(createGroup),
);

router.get('/', asyncHandler(listMyGroups));

router.post(
  '/join',
  // Throttles invite-code guessing by an authenticated attacker.
  rateLimit({
    name: 'group_join:ip',
    max: 20,
    windowMs: HOUR,
    message: 'Too many join attempts. Please try again later.',
  }),
  requirePermission('groups.join'),
  validateBody(joinGroupSchema),
  asyncHandler(joinGroup),
);

/* ---- Group-scoped. `requireGroupMember` proves membership before any handler. ---- */

/**
 * Expenses and settlements are nested under the group, so they inherit the
 * authenticated session established above and enforce their own membership check.
 */
router.use('/:groupId/expenses', expenseRoutes);
router.use('/:groupId/settlements', settlementRoutes);
router.use('/:groupId/reports', reportRoutes);

router.get('/:groupId', asyncHandler(requireGroupMember), asyncHandler(getGroup));

router.get(
  '/:groupId/share',
  asyncHandler(requireGroupMember),
  requirePermission('groups.invite'),
  asyncHandler(getShareInfo),
);

router.post(
  '/:groupId/invite/regenerate',
  asyncHandler(requireGroupMember),
  requirePermission('groups.invite'),
  requireGroupCreator,
  asyncHandler(regenerateInvite),
);

router.patch(
  '/:groupId',
  asyncHandler(requireGroupMember),
  requireGroupCreator,
  validateBody(updateGroupSchema),
  asyncHandler(updateGroup),
);

router.patch(
  '/:groupId/payday',
  asyncHandler(requireGroupMember),
  requireGroupCreator,
  validateBody(setPaydaySchema),
  asyncHandler(setPayday),
);

/**
 * History purge.
 *
 * Creator-only and permission-gated, and the service refuses any range that would move
 * a balance. The preview is separate so the confirmation dialog can show exactly what
 * is about to be destroyed before anything is.
 */
router.post(
  '/:groupId/purge/preview',
  asyncHandler(requireGroupMember),
  requireGroupCreator,
  requirePermission('history.purge'),
  validateBody(purgeFiltersSchema),
  asyncHandler(previewPurgeHandler),
);

router.post(
  '/:groupId/purge',
  asyncHandler(requireGroupMember),
  requireGroupCreator,
  requirePermission('history.purge'),
  rateLimit({ name: 'history_purge:ip', max: 10, windowMs: HOUR }),
  validateBody(purgeExecuteSchema),
  asyncHandler(executePurge),
);

router.get(
  '/:groupId/purge/audits',
  asyncHandler(requireGroupMember),
  requireGroupCreator,
  asyncHandler(listPurgeAudits),
);

router.get(
  '/:groupId/activities',
  asyncHandler(requireGroupMember),
  validateQuery(listActivitiesQuerySchema),
  asyncHandler(listActivities),
);

/**
 * Nudge someone who owes you. Rate limited per sender so a reminder cannot be used to
 * spam another member's notifications and push.
 */
router.post(
  '/:groupId/members/:userId/remind',
  requirePermission('groups.members.remind'),
  asyncHandler(requireGroupMember),
  rateLimit({
    name: 'remind:ip',
    max: 20,
    windowMs: HOUR,
    message: 'You have sent a lot of reminders. Try again later.',
  }),
  asyncHandler(remindMember),
);

router.post('/:groupId/leave', asyncHandler(requireGroupMember), asyncHandler(leaveGroup));

router.delete(
  '/:groupId/members/:userId',
  asyncHandler(requireGroupMember),
  requireGroupCreator,
  asyncHandler(removeMember),
);

router.delete(
  '/:groupId',
  asyncHandler(requireGroupMember),
  requireGroupCreator,
  asyncHandler(deleteGroup),
);

export default router;
