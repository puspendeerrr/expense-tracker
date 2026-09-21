import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { groupMembers, notifications, type Notification } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import * as expoPush from './expoPushService.js';

/**
 * In-app notifications, and the one place a notification fans out.
 *
 * Deliberately fire-and-forget: a notification is a courtesy, not part of the financial
 * transaction. Creating one must never be able to fail an expense or a settlement, so
 * every write here is wrapped and logged rather than thrown.
 *
 * THE FAN-OUT (Phase 4)
 * Every function that writes a notification row now also hands it to the native push
 * transport. That happens HERE rather than at the call sites, which is the whole point:
 * there are thirteen places that raise a notification, and asking each of them to
 * remember a second delivery channel is how one of them ends up forgetting. A business
 * event says "this happened"; this module decides who hears about it and how.
 *
 * Web push is still triggered separately by the call sites that want it. That is not an
 * oversight -- it predates this and carries its own per-call `url`, and rewriting those
 * thirteen sites to prove a point would be a bigger change than the one being made.
 *
 * Push delivery is never awaited. A phone that cannot be reached must not slow down, or
 * fail, the request that caused the notification.
 */

/**
 * What the phone needs in order to route a tap, and nothing else.
 *
 * Only ids and types travel in a push payload. No amounts, no names, no balances: a push
 * payload is handled by the OS, can surface on a lock screen, and is not a place to put
 * somebody's finances. The app fetches the real record -- with the user's own session and
 * the server's own authorisation -- once the tap has taken it to the right screen.
 */
const routeFor = (input: {
  type: NotificationType;
  groupId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): Record<string, string> => {
  const data: Record<string, string> = { type: input.type };
  if (input.groupId) data.groupId = input.groupId;
  if (input.entityType) data.entityType = input.entityType;
  if (input.entityId) data.entityId = input.entityId;
  return data;
};

export type NotificationType = Notification['type'];

export type CreateNotificationInput = {
  recipientUserId: string;
  senderUserId?: string | null;
  groupId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
};

export const createNotification = async (input: CreateNotificationInput): Promise<void> => {
  try {
    await db.insert(notifications).values({
      recipientUserId: input.recipientUserId,
      senderUserId: input.senderUserId ?? null,
      groupId: input.groupId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    });

    void expoPush.sendToUser(input.recipientUserId, {
      category: expoPush.NOTIFICATION_CATEGORY[input.type],
      title: input.title,
      body: input.message,
      data: routeFor(input),
    });
  } catch (error: unknown) {
    logger.error('notification.create_failed', {
      type: input.type,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

/** Notifies every group member except the actor. One insert, not N. */
export const notifyGroup = async (
  groupId: string,
  actorUserId: string,
  payload: Omit<CreateNotificationInput, 'recipientUserId' | 'groupId' | 'senderUserId'>,
): Promise<void> => {
  try {
    const recipients = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), ne(groupMembers.userId, actorUserId)));

    if (recipients.length === 0) return;

    await db.insert(notifications).values(
      recipients.map((recipient) => ({
        recipientUserId: recipient.userId,
        senderUserId: actorUserId,
        groupId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
      })),
    );

    void expoPush.sendToUsers(
      recipients.map((recipient) => recipient.userId),
      {
        category: expoPush.NOTIFICATION_CATEGORY[payload.type],
        title: payload.title,
        body: payload.message,
        data: routeFor({ ...payload, groupId }),
      },
    );
  } catch (error: unknown) {
    logger.error('notification.group_failed', {
      groupId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

/** Notifies a specific subset of members, e.g. only an expense's participants. */
export const notifyUsers = async (
  userIds: string[],
  payload: Omit<CreateNotificationInput, 'recipientUserId'>,
): Promise<void> => {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  try {
    await db.insert(notifications).values(
      unique.map((userId) => ({
        recipientUserId: userId,
        senderUserId: payload.senderUserId ?? null,
        groupId: payload.groupId ?? null,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
      })),
    );

    void expoPush.sendToUsers(unique, {
      category: expoPush.NOTIFICATION_CATEGORY[payload.type],
      title: payload.title,
      body: payload.message,
      data: routeFor(payload),
    });
  } catch (error: unknown) {
    logger.error('notification.users_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

export const listNotifications = async (
  userId: string,
  options: { limit: number; offset: number; unreadOnly?: boolean },
) => {
  const conditions = [eq(notifications.recipientUserId, userId)];
  if (options.unreadOnly) conditions.push(isNull(notifications.readAt));

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  const totals = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(...conditions));

  return { rows, total: totals[0]?.total ?? 0 };
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const rows = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(eq(notifications.recipientUserId, userId), isNull(notifications.readAt)),
    );
  return Number(rows[0]?.value ?? 0);
};

/** Scoped to the recipient, so one user cannot mark another's notifications read. */
export const markRead = async (userId: string, ids: string[]): Promise<number> => {
  if (ids.length === 0) return 0;

  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        inArray(notifications.id, ids),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  return updated.length;
};

export const markAllRead = async (userId: string): Promise<number> => {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.recipientUserId, userId), isNull(notifications.readAt)),
    )
    .returning({ id: notifications.id });

  return updated.length;
};

export const clearAll = async (userId: string): Promise<void> => {
  await db.delete(notifications).where(eq(notifications.recipientUserId, userId));
};
