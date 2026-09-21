import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accountEvents, sessions, type AccountEvent } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { notFound } from '../utils/errors.js';
import * as notificationService from './notificationService.js';

/**
 * Account security: device recognition, login history and the activity timeline.
 *
 * Everything here is derived from data the session layer already captured -- a user
 * agent string and an IP address. There is no geolocation provider in this deployment,
 * so no location is claimed: an approximate city guessed from an IP is the kind of
 * detail people make security decisions on, and a wrong one is worse than none.
 */

/* -------------------------------------------------------------------------- */
/* Device identification                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Coarse browser + OS signature, e.g. "Chrome on Windows".
 *
 * Version numbers are deliberately excluded. A signature that changed with every
 * browser auto-update would mark the same laptop as a new device every few weeks, and
 * an alert that fires constantly is one people learn to dismiss without reading --
 * which is precisely the alert you need them to read.
 *
 * Order matters: Edge and Opera both claim to be Chrome, and Chrome claims to be
 * Safari, so the most specific token has to win.
 */
export const deviceSignature = (userAgent: string | null | undefined): string => {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;

  /*
   * The native app, which identifies itself as
   *   SplitMoney/0.1.0 (Android 16; SM-M346B)
   *
   * Handled before the browser chain because it is not a browser: without this it matched
   * nothing and every phone collapsed to "Unknown device", so a SECOND device signing in
   * shared the first one's signature and raised no new-device alert. That is a missing
   * security notification, not a cosmetic label.
   *
   * The model, not the version, is what distinguishes two phones — and being stable
   * across app updates, it does not re-alert every time the user updates.
   */
  /*
   * `SplitWise` is still accepted alongside `SplitMoney` because a phone running an older
   * build sends the old string. Dropping it would change that device's signature and fire
   * a spurious "new device" security alert at everyone who has not updated yet.
   */
  const app = /^Split(?:Money|Wise)\/[\d.]+ \(([^)]*)\)/.exec(ua);
  if (app) {
    const [platform, model] = (app[1] ?? '').split(';').map((part) => part.trim());
    if (model && model !== 'unknown') return `SplitMoney app on ${model}`;
    if (platform) return `SplitMoney app on ${platform}`;
    return 'SplitMoney app';
  }

  const browser =
    /\bEdgA?\//.test(ua) ? 'Edge'
    : /\bOPR\/|\bOpera\//.test(ua) ? 'Opera'
    : /\bSamsungBrowser\//.test(ua) ? 'Samsung Internet'
    : /\bFirefox\/|\bFxiOS\//.test(ua) ? 'Firefox'
    // Headless Chrome reports "HeadlessChrome/" rather than "Chrome/", so without this
    // it falls through to the Safari branch -- Chrome's UA also contains "Safari" --
    // and a Chromium automation client is labelled "Safari on Windows".
    : /\bHeadlessChrome\//.test(ua) ? 'Chrome'
    : /\bChrome\/|\bCriOS\//.test(ua) ? 'Chrome'
    : /\bSafari\//.test(ua) ? 'Safari'
    : 'Unknown browser';

  const os =
    /\biPhone\b|\biPad\b|\biPod\b/.test(ua) ? 'iOS'
    : /\bAndroid\b/.test(ua) ? 'Android'
    : /\bWindows\b/.test(ua) ? 'Windows'
    : /\bMac OS X\b|\bMacintosh\b/.test(ua) ? 'macOS'
    : /\bCrOS\b/.test(ua) ? 'ChromeOS'
    : /\bLinux\b/.test(ua) ? 'Linux'
    : 'Unknown OS';

  // Two different ways of saying "we have no idea" would flip-flop for a client that
  // sometimes sends no user agent and sometimes sends an unrecognised one, alerting on
  // every login. When neither half is identifiable there is nothing to distinguish, so
  // it collapses to a single signature. A partial match still carries its useful half.
  if (browser === 'Unknown browser' && os === 'Unknown OS') return 'Unknown device';

  return `${browser} on ${os}`;
};

/** True when this user has never successfully signed in from this signature before. */
export const isNewDevice = async (
  userId: string,
  signature: string,
): Promise<boolean> => {
  const seen = await db
    .select({ id: accountEvents.id })
    .from(accountEvents)
    .where(
      and(
        eq(accountEvents.userId, userId),
        eq(accountEvents.deviceSignature, signature),
        eq(accountEvents.type, 'login_succeeded'),
      ),
    )
    .limit(1);

  return seen.length === 0;
};

/* -------------------------------------------------------------------------- */
/* Event recording                                                            */
/* -------------------------------------------------------------------------- */

export type RecordEventInput = {
  userId: string;
  type: AccountEvent['type'];
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceSignature?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Appends an account event.
 *
 * Never allowed to fail the operation that triggered it: refusing a login because its
 * audit row could not be written would turn a logging fault into an outage. The failure
 * is logged instead, so it is visible without being fatal.
 */
export const recordEvent = async (input: RecordEventInput): Promise<void> => {
  try {
    await db.insert(accountEvents).values({
      userId: input.userId,
      type: input.type,
      sessionId: input.sessionId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      deviceSignature: input.deviceSignature ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error: unknown) {
    logger.error('security.event_write_failed', {
      userId: input.userId,
      type: input.type,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
};

/**
 * Records a successful login and raises a notification when the device is unfamiliar.
 *
 * The new-device check runs before the event is written, because writing first would
 * make every login look like a device already seen.
 */
export const recordLogin = async (input: {
  userId: string;
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ isNewDevice: boolean; signature: string }> => {
  const signature = deviceSignature(input.userAgent);
  const fresh = await isNewDevice(input.userId, signature);

  await recordEvent({
    userId: input.userId,
    type: 'login_succeeded',
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceSignature: signature,
  });

  if (fresh) {
    await recordEvent({
      userId: input.userId,
      type: 'new_device_detected',
      sessionId: input.sessionId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceSignature: signature,
    });

    await notifySecurity(input.userId, {
      type: 'security_new_device',
      title: 'New sign-in',
      message: `Your account was signed in to from ${signature}${
        input.ipAddress ? ` (${input.ipAddress})` : ''
      }. If this was not you, change your password and sign out other devices.`,
      entityType: 'session',
      entityId: input.sessionId,
    });
  }

  return { isNewDevice: fresh, signature };
};

/** Records a login attempt that failed against a real account. */
export const recordFailedLogin = async (input: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> => {
  await recordEvent({
    userId: input.userId,
    type: 'login_failed',
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceSignature: deviceSignature(input.userAgent),
  });
};

/**
 * Raises a security notification.
 *
 * Wrapped so a notification failure cannot break the security action that caused it --
 * failing a password change because its notification could not be written would be a
 * worse outcome than the missing notification.
 */
export const notifySecurity = async (
  userId: string,
  input: {
    type: 'security_new_device' | 'security_password_changed' | 'security_session_revoked';
    title: string;
    message: string;
    entityType?: string;
    entityId?: string | null;
  },
): Promise<void> => {
  try {
    await notificationService.createNotification({
      recipientUserId: userId,
      type: input.type,
      title: input.title,
      message: input.message,
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
    });
  } catch (error: unknown) {
    logger.error('security.notification_failed', {
      userId,
      type: input.type,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

const LOGIN_TYPES = ['login_succeeded', 'login_failed', 'new_device_detected'] as const;

export type AccountEventView = {
  id: string;
  type: AccountEvent['type'];
  ipAddress: string | null;
  device: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  /** True when the session this event refers to is still live. */
  sessionActive: boolean;
};

const toView = (row: {
  event: AccountEvent;
  sessionRevokedAt: Date | null;
  sessionExpiresAt: Date | null;
}): AccountEventView => ({
  id: row.event.id,
  type: row.event.type,
  ipAddress: row.event.ipAddress,
  device: row.event.deviceSignature,
  metadata: row.event.metadata,
  createdAt: row.event.createdAt.toISOString(),
  sessionActive:
    row.sessionExpiresAt !== null &&
    row.sessionRevokedAt === null &&
    row.sessionExpiresAt.getTime() > Date.now(),
});

/**
 * One user's account events, newest first.
 *
 * `scope: 'logins'` narrows to sign-in activity for the login-history screen; 'all'
 * feeds the account activity timeline. Same rows, same query, different filter.
 */
export const listEvents = async (options: {
  userId: string;
  scope: 'all' | 'logins';
  limit: number;
  offset: number;
}): Promise<{ rows: AccountEventView[]; total: number }> => {
  const scopeFilter =
    options.scope === 'logins'
      ? sql`${accountEvents.type} in ('login_succeeded', 'login_failed', 'new_device_detected')`
      : sql`true`;

  const where = and(eq(accountEvents.userId, options.userId), scopeFilter);

  const rows = await db
    .select({
      event: accountEvents,
      sessionRevokedAt: sessions.revokedAt,
      sessionExpiresAt: sessions.expiresAt,
    })
    .from(accountEvents)
    .leftJoin(sessions, eq(sessions.id, accountEvents.sessionId))
    .where(where)
    .orderBy(desc(accountEvents.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  const totals = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountEvents)
    .where(where);

  return { rows: rows.map(toView), total: totals[0]?.count ?? 0 };
};

export { LOGIN_TYPES };

/* -------------------------------------------------------------------------- */
/* Sessions / devices                                                         */
/* -------------------------------------------------------------------------- */

export type DeviceView = {
  id: string;
  name: string | null;
  /** Derived label, used when the device has not been named. */
  device: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

/**
 * The account's live sessions.
 *
 * Only unrevoked, unexpired rows: a list that included dead sessions would make an
 * account look compromised when it is merely old. The token hash is never selected, so
 * it cannot leak through this path even by accident.
 */
export const listDevices = async (
  userId: string,
  currentSessionId: string,
): Promise<DeviceView[]> => {
  const rows = await db
    .select({
      id: sessions.id,
      deviceName: sessions.deviceName,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.lastUsedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.deviceName,
    device: deviceSignature(row.userAgent),
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    isCurrent: row.id === currentSessionId,
  }));
};

/** Names a device. Scoped to the owner, so one account cannot rename another's session. */
export const renameDevice = async (
  userId: string,
  sessionId: string,
  name: string | null,
): Promise<DeviceView | undefined> => {
  const updated = await db
    .update(sessions)
    .set({ deviceName: name })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });

  if (!updated[0]) throw notFound('That device was not found.');

  await recordEvent({
    userId,
    type: 'device_renamed',
    sessionId,
    metadata: { name },
  });

  return undefined;
};

/**
 * Revokes one session belonging to this account.
 *
 * The ownership predicate is part of the UPDATE rather than a prior SELECT, so there is
 * no window between checking and acting, and a session id belonging to someone else
 * simply matches nothing.
 */
export const revokeOwnSession = async (
  userId: string,
  sessionId: string,
  actorSessionId: string,
): Promise<{ revokedSelf: boolean }> => {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
      ),
    )
    .returning({ id: sessions.id, userAgent: sessions.userAgent });

  const row = revoked[0];
  if (!row) throw notFound('That device was not found, or is already signed out.');

  await recordEvent({
    userId,
    type: 'session_revoked',
    sessionId,
    metadata: { device: deviceSignature(row.userAgent) },
  });

  // Signing yourself out is an ordinary logout, not something to alert about.
  if (sessionId !== actorSessionId) {
    await notifySecurity(userId, {
      type: 'security_session_revoked',
      title: 'A device was signed out',
      message: `${deviceSignature(row.userAgent)} was signed out of your account.`,
      entityType: 'session',
      entityId: sessionId,
    });
  }

  return { revokedSelf: sessionId === actorSessionId };
};

/** Signs out every other device, leaving the caller signed in. */
export const revokeOtherSessions = async (
  userId: string,
  keepSessionId: string,
): Promise<number> => {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.id, keepSessionId),
        isNull(sessions.revokedAt),
      ),
    )
    .returning({ id: sessions.id });

  if (revoked.length > 0) {
    await recordEvent({
      userId,
      type: 'sessions_revoked_all',
      sessionId: keepSessionId,
      metadata: { count: revoked.length },
    });

    await notifySecurity(userId, {
      type: 'security_session_revoked',
      title: 'Other devices signed out',
      message: `${revoked.length} other ${
        revoked.length === 1 ? 'device was' : 'devices were'
      } signed out of your account.`,
    });
  }

  return revoked.length;
};
