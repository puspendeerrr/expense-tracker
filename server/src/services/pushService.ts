import webpush from 'web-push';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { groupMembers, pushSubscriptions } from '../db/schema.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Web push delivery.
 *
 * Push is strictly best-effort: a failed notification must never fail the financial
 * operation that triggered it, so every send is wrapped and every caller uses `void`.
 *
 * Subscriptions expire on their own (browser reinstall, cleared data, revoked
 * permission). The push service reports that as 404/410, and we prune the row rather
 * than retrying forever.
 */

const isConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (isConfigured) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
} else {
  logger.info('push.disabled', { reason: 'VAPID keys not configured' });
}

export const isPushConfigured = (): boolean => isConfigured;
export const getPublicKey = (): string | null => env.VAPID_PUBLIC_KEY ?? null;

export type PushPayload = {
  title: string;
  body: string;
  /** Where clicking the notification should take the user. */
  url?: string;
  tag?: string;
};

export const saveSubscription = async (input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> => {
  // The endpoint is unique per browser: re-subscribing updates the existing row rather
  // than accumulating duplicates for the same device.
  await db
    .insert(pushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        lastUsedAt: new Date(),
      },
    });
};

export const removeSubscription = async (userId: string, endpoint: string): Promise<void> => {
  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)),
    );
};

export const listSubscriptions = async (userId: string) =>
  db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

/** Sends to one subscription, pruning it if the push service says it is gone. */
const sendToSubscription = async (
  subscription: typeof pushSubscriptions.$inferSelect,
  payload: PushPayload,
): Promise<void> => {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;

    if (statusCode === 404 || statusCode === 410) {
      // Gone for good: the browser dropped this subscription.
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscription.id))
        .catch(() => undefined);
      return;
    }

    logger.warn('push.send_failed', {
      statusCode,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

export const sendToUser = async (userId: string, payload: PushPayload): Promise<void> => {
  if (!isConfigured) return;
  try {
    const subscriptions = await listSubscriptions(userId);
    await Promise.all(subscriptions.map((sub) => sendToSubscription(sub, payload)));
  } catch (error: unknown) {
    logger.warn('push.user_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

export const sendToUsers = async (userIds: string[], payload: PushPayload): Promise<void> => {
  if (!isConfigured) return;
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, unique));
    await Promise.all(subscriptions.map((sub) => sendToSubscription(sub, payload)));
  } catch (error: unknown) {
    logger.warn('push.users_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

/** Everyone in the group except the person who caused the event. */
export const sendToGroup = async (
  groupId: string,
  actorUserId: string,
  payload: PushPayload,
): Promise<void> => {
  if (!isConfigured) return;
  try {
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), ne(groupMembers.userId, actorUserId)));

    await sendToUsers(
      members.map((member) => member.userId),
      payload,
    );
  } catch (error: unknown) {
    logger.warn('push.group_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};
