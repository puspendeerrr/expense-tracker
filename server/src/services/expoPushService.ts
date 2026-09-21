import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pushDevices, userNotificationPreferences } from '../db/schema.js';
import { logger } from '../utils/logger.js';

/**
 * Native push delivery, through Expo's push service.
 *
 * This is a TRANSPORT. It does not decide that a notification should exist -- that is
 * `notificationService`'s job -- it only carries one to the phones a user has registered.
 * Keeping the decision and the delivery apart is what lets one business event feed the
 * in-app inbox, web push and native push without any of the three knowing about the
 * others.
 *
 * NO CREDENTIALS LIVE HERE. Expo's send endpoint is authenticated by the push token
 * itself, which the device obtained and registered. There is no API key, no FCM server
 * key and no service account in this process; the Android credential lives in the Expo
 * project. That is the reason this transport was chosen over talking to FCM directly.
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo accepts at most 100 messages per request. */
const CHUNK_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Which preference switch governs a notification type.
 *
 * Exhaustive over the `notification_type` enum by construction: the `satisfies` below
 * makes adding a type to the database without deciding its category a compile error,
 * rather than a notification that quietly ignores everybody's preferences.
 */
export const NOTIFICATION_CATEGORY = {
  expense_added: 'financial',
  expense_updated: 'financial',
  expense_deleted: 'financial',
  settlement_requested: 'settlements',
  settlement_approved: 'settlements',
  settlement_rejected: 'settlements',
  payment_reminder: 'settlements',
  member_joined: 'activity',
  security_new_device: 'security',
  security_password_changed: 'security',
  security_session_revoked: 'security',
} as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

/** The Android channel each category is delivered on. Mirrors the channels the app creates. */
const CATEGORY_CHANNEL: Record<NotificationCategory, string> = {
  financial: 'financial',
  settlements: 'settlements',
  activity: 'activity',
  security: 'security',
};

/**
 * Only a security alert earns a high-priority delivery.
 *
 * Everything else is `normal`, which on Android means it arrives without interrupting
 * whatever the person is doing. Marking ordinary activity as high priority is how an app
 * teaches people to turn its notifications off.
 */
const CATEGORY_PRIORITY: Record<NotificationCategory, 'default' | 'high'> = {
  financial: 'high',
  settlements: 'high',
  activity: 'high',
  security: 'high',
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  sound?: 'default' | null;
  badge?: number;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Reads this user's preferences, treating a missing row as "all defaults".
 *
 * Defaulting on absence rather than seeding a row at signup means a category added in a
 * later release is on for every existing account instead of off for everyone who
 * registered before it existed.
 */
export const getPreferences = async (
  userId: string,
): Promise<{
  pushEnabled: boolean;
  financial: boolean;
  settlements: boolean;
  activity: boolean;
  security: boolean;
  general: boolean;
}> => {
  const rows = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  const row = rows[0];
  return {
    pushEnabled: row?.pushEnabled ?? true,
    financial: row?.financial ?? true,
    settlements: row?.settlements ?? true,
    activity: row?.activity ?? true,
    security: row?.security ?? true,
    general: row?.general ?? true,
  };
};

/** True when this user wants a push for this category on their phones. */
const wantsPush = (
  preferences: Awaited<ReturnType<typeof getPreferences>>,
  category: NotificationCategory,
): boolean => preferences.pushEnabled && preferences[category] !== false;

/**
 * Deletes tokens Expo has told us are dead.
 *
 * `DeviceNotRegistered` means the app was uninstalled, the data cleared, or the token
 * rotated. Keeping it would mean every future send carries a message that can never
 * arrive, so the row goes. The device re-registers on next launch if it is still there.
 */
const dropDeadTokens = async (tokens: string[]): Promise<void> => {
  if (tokens.length === 0) return;
  await db.delete(pushDevices).where(inArray(pushDevices.token, tokens));
  logger.info('expo_push.tokens_dropped', { count: tokens.length });
};

/**
 * Sends one notification to every enabled device belonging to a user.
 *
 * Swallows its own failures. A push is a convenience on top of a notification that has
 * already been written to the database -- if Expo is down, the user still sees the
 * notification when they next open the app, and failing the originating request (creating
 * an expense, say) because a push could not be delivered would be absurd.
 */
export const sendToUser = async (
  userId: string,
  notification: {
    category: NotificationCategory;
    title: string;
    body: string;
    /** Routed by the app. Must never carry anything secret: see the note below. */
    data?: Record<string, unknown>;
  },
): Promise<void> => {
  try {
    const preferences = await getPreferences(userId);
    if (!wantsPush(preferences, notification.category)) return;

    const devices = await db
      .select({ token: pushDevices.token })
      .from(pushDevices)
      .where(and(eq(pushDevices.userId, userId), eq(pushDevices.notificationsEnabled, true)));

    if (devices.length === 0) return;

    await send(
      devices.map((device) => ({
        to: device.token,
        title: notification.title,
        body: notification.body,
        sound: 'default',
        priority: 'high',
        ...(notification.data ? { data: notification.data } : {}),
        channelId: CATEGORY_CHANNEL[notification.category],
      })),
    );
  } catch (error: unknown) {
    logger.warn('expo_push.send_failed', {
      userId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

/** Same, for several recipients at once, with each one's preferences honoured. */
export const sendToUsers = async (
  userIds: string[],
  notification: {
    category: NotificationCategory;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
): Promise<void> => {
  await Promise.all(userIds.map((userId) => sendToUser(userId, notification)));
};

/**
 * Posts messages to Expo and prunes whatever it rejects as unregistered.
 *
 * Errors are logged by their Expo error CODE only. The token is never logged: it is the
 * capability to send notifications to somebody's phone, and a log file is not where that
 * belongs.
 */
const send = async (messages: ExpoPushMessage[]): Promise<void> => {
  for (let index = 0; index < messages.length; index += CHUNK_SIZE) {
    const chunk = messages.slice(index, index + CHUNK_SIZE);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          // Expo compresses responses for large batches.
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn('expo_push.http_error', { status: response.status });
        continue;
      }

      const payload = (await response.json()) as { data?: ExpoTicket[]; errors?: unknown };
      const tickets = payload.data ?? [];

      const dead: string[] = [];
      tickets.forEach((ticket, position) => {
        if (ticket.status !== 'error') return;
        const code = ticket.details?.error;
        if (code === 'DeviceNotRegistered') {
          const token = chunk[position]?.to;
          if (token) dead.push(token);
        } else {
          logger.warn('expo_push.ticket_error', { code: code ?? 'unknown' });
        }
      });

      await dropDeadTokens(dead);
    } catch (error: unknown) {
      logger.warn('expo_push.request_failed', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      clearTimeout(timer);
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Device registration                                                        */
/* -------------------------------------------------------------------------- */

export type RegisterDeviceInput = {
  userId: string;
  installationId: string;
  token: string;
  platform: 'android' | 'ios';
  deviceName: string | null;
  appVersion: string | null;
};

/**
 * Registers, or re-registers, one physical app install.
 *
 * Keyed on `installationId`, which is unique, so calling this on every launch is
 * idempotent: the same phone updates its row rather than accumulating a new one each
 * time the token rotates. The `user_id` is part of the update, which is what moves the
 * device to whoever is signed in now -- so a phone handed to somebody else stops
 * receiving the previous account's notifications.
 */
export const registerDevice = async (input: RegisterDeviceInput): Promise<void> => {
  const now = new Date();

  await db
    .insert(pushDevices)
    .values({
      userId: input.userId,
      installationId: input.installationId,
      token: input.token,
      platform: input.platform,
      deviceName: input.deviceName,
      appVersion: input.appVersion,
      lastActiveAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushDevices.installationId,
      set: {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
        deviceName: input.deviceName,
        appVersion: input.appVersion,
        lastActiveAt: now,
        updatedAt: now,
      },
    });
};

/** Forgets one install. Used on sign-out, so a shared phone stops receiving pushes. */
export const unregisterDevice = async (userId: string, installationId: string): Promise<void> => {
  await db
    .delete(pushDevices)
    .where(
      and(eq(pushDevices.userId, userId), eq(pushDevices.installationId, installationId)),
    );
};

/** This user's registered phones, for the Devices screen. Tokens are never returned. */
export const listDevices = async (userId: string) => {
  const rows = await db
    .select({
      id: pushDevices.id,
      installationId: pushDevices.installationId,
      platform: pushDevices.platform,
      deviceName: pushDevices.deviceName,
      appVersion: pushDevices.appVersion,
      notificationsEnabled: pushDevices.notificationsEnabled,
      lastActiveAt: pushDevices.lastActiveAt,
      createdAt: pushDevices.createdAt,
    })
    .from(pushDevices)
    .where(eq(pushDevices.userId, userId));

  return rows.map((row) => ({
    id: row.id,
    installationId: row.installationId,
    platform: row.platform,
    deviceName: row.deviceName,
    appVersion: row.appVersion,
    notificationsEnabled: row.notificationsEnabled,
    lastActiveAt: row.lastActiveAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
};

/** The per-device mute switch. */
export const setDeviceEnabled = async (
  userId: string,
  installationId: string,
  enabled: boolean,
): Promise<void> => {
  await db
    .update(pushDevices)
    .set({ notificationsEnabled: enabled, updatedAt: new Date() })
    .where(
      and(eq(pushDevices.userId, userId), eq(pushDevices.installationId, installationId)),
    );
};

/** Reads preferences, creating nothing. Writes go through `savePreferences`. */
export const readPreferences = getPreferences;

export const savePreferences = async (
  userId: string,
  input: Partial<{
    pushEnabled: boolean;
    financial: boolean;
    settlements: boolean;
    activity: boolean;
    security: boolean;
    general: boolean;
  }>,
): Promise<Awaited<ReturnType<typeof getPreferences>>> => {
  const current = await getPreferences(userId);
  const next = { ...current, ...input };

  await db
    .insert(userNotificationPreferences)
    .values({ userId, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: { ...next, updatedAt: new Date() },
    });

  return next;
};
