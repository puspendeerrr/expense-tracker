import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { groups, type Group, type GroupMember, type User } from '../db/schema.js';
import { sendOk } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { paiseToRupees } from '../utils/money.js';
import { calculateBillingCycle } from '../utils/billingCycle.js';
import { validated, validatedQuery } from '../middleware/validate.js';
import {
  createGroupSchema,
  joinGroupSchema,
  groupMediaSchema,
  setPaydaySchema,
  updateGroupSchema,
  listActivitiesQuerySchema,
} from '../validation/groupSchemas.js';
import * as groupService from '../services/groupService.js';
import { getGroupBalanceTotals, getOutstandingBetween } from '../services/balanceService.js';
import * as activityService from '../services/activityService.js';
import * as pushService from '../services/pushService.js';
import { formatPaise } from '../utils/money.js';
import { ERROR_CODES, badRequest, notFound } from '../utils/errors.js';
import { publishToGroup } from '../realtime/socketServer.js';
import { REALTIME_EVENTS } from '../realtime/events.js';
import * as notificationService from '../services/notificationService.js';

/* -------------------------------------------------------------------------- */
/* Presenters                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Public group shape.
 *
 * Deliberately excludes `inviteToken`. The token is a bearer secret for joining, so it
 * is only ever served from the dedicated share endpoint to a proven member -- never
 * bundled into general group payloads the way the reference implementation did.
 */
const publicGroup = (group: Group, role?: GroupMember['role'], memberCount?: number) => ({
  id: group.id,
  name: group.name,
  description: group.description,
  currency: group.currency,
  inviteCode: group.inviteCode,
  payday: group.payday,
  avatarUrl: group.avatarUrl ?? null,
  coverUrl: group.coverUrl ?? null,
  createdBy: group.createdBy,
  createdAt: group.createdAt.toISOString(),
  ...(role ? { role } : {}),
  ...(memberCount !== undefined ? { memberCount } : {}),
});

const publicMember = (
  user: User,
  membership: GroupMember,
  totals?: { owesPaise: number; receivesPaise: number },
) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  upiId: user.upiId ?? null,
  qrCodeUrl: user.qrCodeUrl ?? null,
  role: membership.role,
  joinedAt: membership.joinedAt.toISOString(),
  owesPaise: totals?.owesPaise ?? 0,
  receivesPaise: totals?.receivesPaise ?? 0,
  owes: paiseToRupees(totals?.owesPaise ?? 0),
  receives: paiseToRupees(totals?.receivesPaise ?? 0),
  netPaise: (totals?.receivesPaise ?? 0) - (totals?.owesPaise ?? 0),
});

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = validated(req, createGroupSchema);

  const { group, membership } = await groupService.createGroup({
    name,
    description: description ?? null,
    userId: req.user!.id,
  });

  logger.info('group.created', { groupId: group.id, userId: req.user!.id });

  sendOk(res, { group: publicGroup(group, membership.role, 1) }, 201);
};

export const listMyGroups = async (req: Request, res: Response): Promise<void> => {
  const rows = await groupService.listUserGroups(req.user!.id);
  sendOk(res, {
    groups: rows.map((row) => publicGroup(row.group, row.membership.role, row.memberCount)),
  });
};

/**
 * Joins by code, token, or a pasted invite URL.
 *
 * Responds 200 (not an error) when the caller is already a member: re-scanning a QR
 * code you already used is a no-op, not a failure, and the client just navigates in.
 */
export const joinGroup = async (req: Request, res: Response): Promise<void> => {
  const { invite } = validated(req, joinGroupSchema);

  const result = await groupService.joinGroupByInvite(invite, req.user!.id);

  logger.info('group.joined', {
    groupId: result.group.id,
    userId: req.user!.id,
    alreadyMember: result.alreadyMember,
  });

  if (!result.alreadyMember) {
    void notificationService.notifyGroup(result.group.id, req.user!.id, {
      type: 'member_joined',
      title: 'New member',
      message: `${req.user!.fullName} joined ${result.group.name}.`,
      entityType: 'group',
      entityId: result.group.id,
    });

    publishToGroup({
      event: REALTIME_EVENTS.MEMBER_JOINED,
      groupId: result.group.id,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      entityId: req.user!.id,
      message: `${req.user!.fullName} joined the group`,
    });
  }

  sendOk(
    res,
    {
      group: publicGroup(result.group, result.membership.role),
      alreadyMember: result.alreadyMember,
    },
    result.alreadyMember ? 200 : 201,
  );
};

/**
 * Unauthenticated-safe invite preview, so an invited person can see what they are
 * joining before signing up. Returns only the group's name, description and member
 * count -- never the token, never the financial state.
 */
export const previewInvite = async (req: Request, res: Response): Promise<void> => {
  const invite = String(req.params.invite ?? '');
  const preview = await groupService.getInvitePreview(invite, req.user?.id);
  sendOk(res, preview);
};

/** Full group detail: members with their live balance totals, plus the billing cycle. */
export const getGroup = async (req: Request, res: Response): Promise<void> => {
  const group = req.group!;
  const [members, totals] = await Promise.all([
    groupService.listGroupMembers(group.id),
    getGroupBalanceTotals(group.id),
  ]);

  sendOk(res, {
    group: publicGroup(group, req.membership!.role, members.length),
    billingCycle: calculateBillingCycle(group.payday),
    members: members.map((row) =>
      publicMember(row.user, row.membership, totals.get(row.user.id)),
    ),
  });
};

/**
 * Share payload for the QR screen. Members only -- the token lives behind
 * `requireGroupMember`, so a leaked group id alone cannot yield a working invite.
 */
export const getShareInfo = async (req: Request, res: Response): Promise<void> => {
  const group = req.group!;
  const members = await groupService.listGroupMembers(group.id);

  sendOk(res, {
    groupId: group.id,
    groupName: group.name,
    inviteCode: group.inviteCode,
    inviteToken: group.inviteToken,
    /** Relative on purpose: the client resolves it against its own origin. */
    invitePath: `/join/${group.inviteToken}`,
    inviteRotatedAt: group.inviteRotatedAt.toISOString(),
    memberCount: members.length,
    isCreator: req.membership!.role === 'creator',
  });
};

/** Creator-only. Rotating invalidates every previously shared link and QR code. */
export const regenerateInvite = async (req: Request, res: Response): Promise<void> => {
  const group = await groupService.regenerateInvite(req.group!.id, req.user!.id);

  logger.info('group.invite_regenerated', { groupId: group.id, userId: req.user!.id });

  publishToGroup({
    event: REALTIME_EVENTS.INVITE_REGENERATED,
    groupId: group.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    message: `${req.user!.fullName} regenerated the group invite`,
  });

  sendOk(res, {
    inviteCode: group.inviteCode,
    inviteToken: group.inviteToken,
    invitePath: `/join/${group.inviteToken}`,
    inviteRotatedAt: group.inviteRotatedAt.toISOString(),
  });
};

export const updateGroup = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, updateGroupSchema);

  const updated = await db
    .update(groups)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedAt: new Date(),
    })
    .where(eq(groups.id, req.group!.id))
    .returning();

  sendOk(res, { group: publicGroup(updated[0]!, req.membership!.role) });
};

export const setPayday = async (req: Request, res: Response): Promise<void> => {
  const { payday } = validated(req, setPaydaySchema);
  const group = await groupService.setPayday(req.group!.id, req.user!.id, payday);

  sendOk(res, {
    group: publicGroup(group, req.membership!.role),
    billingCycle: calculateBillingCycle(group.payday),
  });
};

/** Leaves the group. The outstanding-balance guard lives in the service, server-side. */
export const leaveGroup = async (req: Request, res: Response): Promise<void> => {
  const result = await groupService.leaveGroup(req.group!.id, req.user!.id);

  logger.info('group.left', {
    groupId: req.group!.id,
    userId: req.user!.id,
    groupDeleted: result.groupDeleted,
  });

  if (!result.groupDeleted) {

    publishToGroup({
      event: REALTIME_EVENTS.MEMBER_LEFT,
      groupId: req.group!.id,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      entityId: req.user!.id,
      message: `${req.user!.fullName} left the group`,
    });
  }

  sendOk(res, result);
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  const targetUserId = String(req.params.userId ?? '');
  await groupService.removeMember(req.group!.id, req.user!.id, targetUserId);

  logger.info('group.member_removed', {
    groupId: req.group!.id,
    actorId: req.user!.id,
    targetId: targetUserId,
  });

  publishToGroup({
    event: REALTIME_EVENTS.MEMBER_REMOVED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: targetUserId,
    message: `A member was removed from the group`,
  });

  sendOk(res, { removed: true });
};

export const deleteGroup = async (req: Request, res: Response): Promise<void> => {
  await groupService.deleteGroup(req.group!.id);
  logger.info('group.deleted', { groupId: req.group!.id, userId: req.user!.id });
  sendOk(res, { deleted: true });
};

/**
 * Sets or clears the group's avatar and cover image.
 *
 * The group comes from the proven membership on the request, never from the body, and
 * the route is creator-only -- so a member cannot restyle a group they merely belong to.
 */
export const setGroupMedia = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, groupMediaSchema);
  const { group } = await groupService.setGroupMedia(req.group!.id, input);

  logger.info('group.media_updated', {
    groupId: group.id,
    userId: req.user!.id,
    changed: Object.keys(input),
  });

  // Everyone looking at the group should see the new image without a reload.
  publishToGroup({
    event: REALTIME_EVENTS.GROUP_UPDATED,
    groupId: group.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    message: 'The group images were updated',
  });

  sendOk(res, { group: publicGroup(group, req.membership!.role) });
};

/* -------------------------------------------------------------------------- */
/* Activity feed                                                              */
/* -------------------------------------------------------------------------- */

export const listActivities = async (req: Request, res: Response): Promise<void> => {
  const query = validatedQuery(req, listActivitiesQuerySchema);
  const { limit, offset } = query;

  const { rows, total } = await activityService.listActivities({
    // Always the proven group from the middleware, never one named in the query.
    groupId: req.group!.id,
    limit,
    offset,
    ...(query.search ? { search: query.search } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });

  sendOk(res, {
    activities: rows.map((row) => ({
      id: row.activity.id,
      type: row.activity.type,
      entityType: row.activity.entityType,
      entityId: row.activity.entityId,
      metadata: row.activity.metadata,
      createdAt: row.activity.createdAt.toISOString(),
      actor: row.actor,
      isMe: row.actor.id === req.user!.id,
    })),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
};

/** The activity types this group actually has, so the filter offers no empty options. */
export const listActivityTypes = async (req: Request, res: Response): Promise<void> => {
  sendOk(res, { types: await activityService.listActivityTypes(req.group!.id) });
};

/* -------------------------------------------------------------------------- */
/* Payment reminder                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Nudges someone who owes the caller money.
 *
 * The amount is taken from the balance engine, never from the request: a reminder
 * quoting a client-supplied figure would let anyone claim any sum. Sending is only
 * permitted when a debt actually exists in that direction.
 */
export const remindMember = async (req: Request, res: Response): Promise<void> => {
  const groupId = req.group!.id;
  const targetUserId = String(req.params.userId ?? '');

  if (targetUserId === req.user!.id) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'You cannot remind yourself.');
  }

  const members = await groupService.listGroupMembers(groupId);
  const target = members.find((row) => row.user.id === targetUserId);
  if (!target) {
    throw notFound('That person is not a member of this group.');
  }

  const owedPaise = await getOutstandingBetween(groupId, targetUserId, req.user!.id);
  if (owedPaise <= 0) {
    throw badRequest(
      ERROR_CODES.VALIDATION_ERROR,
      'They do not currently owe you anything.',
    );
  }

  const amount = formatPaise(owedPaise);

  void notificationService.createNotification({
    recipientUserId: targetUserId,
    senderUserId: req.user!.id,
    groupId,
    type: 'payment_reminder',
    title: 'Payment reminder',
    message: `${req.user!.fullName} is waiting for ${amount} in ${req.group!.name}.`,
    entityType: 'group',
    entityId: groupId,
  });

  void pushService.sendToUser(targetUserId, {
    title: 'Payment reminder',
    body: `${req.user!.fullName} is waiting for ${amount}`,
    url: '/app/settlements',
    tag: `reminder-${groupId}-${req.user!.id}`,
  });

  logger.info('group.reminder_sent', { groupId, from: req.user!.id, to: targetUserId });

  sendOk(res, { sent: true, amountPaise: owedPaise, amount });
};
