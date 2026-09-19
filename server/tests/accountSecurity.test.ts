import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { accountEvents, notifications, sessions } from '../src/db/schema.js';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { deviceSignature } from '../src/services/securityService.js';

/**
 * Account security: devices, login history and security notifications.
 *
 * The bar for this area is not "the happy path works" -- it is that one account can
 * never see or touch another's sessions, and that no response anywhere carries a token.
 */

beforeEach(resetAll);
afterAll(closeDatabase);

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const FIREFOX_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';

const PASSWORD = 'QaPassword1';

const person = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, PASSWORD, name);
  return { cookie, userId, email: `${name}@example.com` };
};

/** Signs in again from a given browser, returning the new session cookie. */
const loginAs = async (email: string, userAgent: string, password = PASSWORD) => {
  const res = await api()
    .post('/api/auth/login')
    .set('User-Agent', userAgent)
    .send({ email, password })
    .expect(200);

  const raw = res.headers['set-cookie'] as unknown as string[];
  return raw.map((c) => c.split(';')[0]).join('; ');
};

const devicesOf = async (cookie: string) => {
  const res = await api().get('/api/auth/security/devices').set('Cookie', cookie).expect(200);
  return res.body.data.devices as {
    id: string;
    name: string | null;
    device: string;
    isCurrent: boolean;
  }[];
};

const eventsOf = async (cookie: string, scope = 'all') => {
  const res = await api()
    .get(`/api/auth/security/events?scope=${scope}&limit=100`)
    .set('Cookie', cookie)
    .expect(200);
  return res.body.data.events as { type: string; device: string | null }[];
};

/* ========================================================================== */
/* Device signature                                                           */
/* ========================================================================== */

describe('device signature', () => {
  it('names browser and OS families', () => {
    expect(deviceSignature(CHROME_WIN)).toBe('Chrome on Windows');
    expect(deviceSignature(SAFARI_IOS)).toBe('Safari on iOS');
    expect(deviceSignature(FIREFOX_MAC)).toBe('Firefox on macOS');
  });

  it('prefers the most specific token when browsers impersonate each other', () => {
    // Edge and Opera both carry "Chrome" in their UA; Chrome carries "Safari".
    expect(
      deviceSignature(`${CHROME_WIN} Edg/120.0.0.0`),
    ).toBe('Edge on Windows');
    expect(deviceSignature(`${CHROME_WIN} OPR/106.0.0.0`)).toBe('Opera on Windows');
    // Chrome's UA contains 'Safari', and headless Chrome does not contain 'Chrome/'.
    expect(deviceSignature(CHROME_WIN.replace('Chrome/', 'HeadlessChrome/'))).toBe(
      'Chrome on Windows',
    );
  });

  it('ignores the version, so a browser update is not a new device', () => {
    const older = CHROME_WIN.replace('120.0.0.0', '118.0.0.0');
    expect(deviceSignature(older)).toBe(deviceSignature(CHROME_WIN));
  });

  it('degrades to a readable label rather than throwing', () => {
    expect(deviceSignature(null)).toBe('Unknown device');
    expect(deviceSignature('')).toBe('Unknown device');
    // Neither half identifiable collapses to one signature, so a client that sends
    // no user agent and one that sends an unrecognised one are the same device.
    expect(deviceSignature('curl/8.0')).toBe('Unknown device');
    expect(deviceSignature('curl/8.0')).toBe(deviceSignature(null));
  });
});

/* ========================================================================== */
/* Login history                                                              */
/* ========================================================================== */

describe('login history', () => {
  it('records a successful sign-in with its device', async () => {
    const me = await person('alpha');
    const cookie = await loginAs(me.email, CHROME_WIN);

    const events = await eventsOf(cookie, 'logins');
    const success = events.find((e) => e.type === 'login_succeeded');
    expect(success).toBeDefined();
    expect(success!.device).toBe('Chrome on Windows');
  });

  it('records a failed sign-in against a real account', async () => {
    const me = await person('bravo');

    await api()
      .post('/api/auth/login')
      .set('User-Agent', CHROME_WIN)
      .send({ email: me.email, password: 'WrongPassword9' })
      .expect(401);

    const events = await eventsOf(me.cookie, 'logins');
    expect(events.some((e) => e.type === 'login_failed')).toBe(true);
  });

  it('does not record attempts against addresses with no account', async () => {
    await person('charlie');

    await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword9' })
      .expect(401);

    const rows = await db.select().from(accountEvents).where(eq(accountEvents.type, 'login_failed'));
    expect(rows).toHaveLength(0);
  });

  it('separates login history from the full activity timeline', async () => {
    const me = await person('delta');
    await api().post('/api/auth/profile/password').set('Cookie', me.cookie).send({
      currentPassword: PASSWORD,
      newPassword: 'AnotherPass9',
      confirmPassword: 'AnotherPass9',
    }).expect(200);

    const logins = await eventsOf(me.cookie, 'logins');
    const all = await eventsOf(me.cookie, 'all');

    expect(logins.some((e) => e.type === 'password_changed')).toBe(false);
    expect(all.some((e) => e.type === 'password_changed')).toBe(true);
  });
});

/* ========================================================================== */
/* New device detection                                                       */
/* ========================================================================== */

describe('new device detection', () => {
  it('does not alert for the browser the account signed up on', async () => {
    const me = await person('echo');

    // signupUser establishes the first session; signing in again from the same
    // signature must not be treated as new.
    await loginAs(me.email, 'node-superagent/x');

    const alerts = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, me.userId));

    expect(alerts.filter((n) => n.type === 'security_new_device')).toHaveLength(0);
  });

  it('alerts once for a genuinely unfamiliar device', async () => {
    const me = await person('foxtrot');
    await loginAs(me.email, SAFARI_IOS);

    const alerts = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, me.userId));

    const newDevice = alerts.filter((n) => n.type === 'security_new_device');
    expect(newDevice).toHaveLength(1);
    expect(newDevice[0]!.message).toContain('Safari on iOS');
  });

  it('does not alert again for a device already seen', async () => {
    const me = await person('golf');
    await loginAs(me.email, SAFARI_IOS);
    await loginAs(me.email, SAFARI_IOS);
    await loginAs(me.email, SAFARI_IOS.replace('17_0', '17_2'));

    const alerts = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, me.userId));

    expect(alerts.filter((n) => n.type === 'security_new_device')).toHaveLength(1);
  });

  it('alerts separately for a second unfamiliar device', async () => {
    const me = await person('hotel');
    await loginAs(me.email, SAFARI_IOS);
    await loginAs(me.email, FIREFOX_MAC);

    const alerts = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, me.userId));

    expect(alerts.filter((n) => n.type === 'security_new_device')).toHaveLength(2);
  });
});

/* ========================================================================== */
/* Devices                                                                    */
/* ========================================================================== */

describe('device management', () => {
  it('lists live sessions and marks the current one', async () => {
    const me = await person('india');
    const second = await loginAs(me.email, SAFARI_IOS);

    const devices = await devicesOf(second);
    expect(devices.length).toBeGreaterThanOrEqual(2);
    expect(devices.filter((d) => d.isCurrent)).toHaveLength(1);
    expect(devices.some((d) => d.device === 'Safari on iOS')).toBe(true);
  });

  it('never returns a token or hash', async () => {
    const me = await person('juliet');
    const res = await api()
      .get('/api/auth/security/devices')
      .set('Cookie', me.cookie)
      .expect(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/tokenHash|token_hash/i);

    const [row] = await db.select().from(sessions).where(eq(sessions.userId, me.userId)).limit(1);
    expect(body).not.toContain(row!.tokenHash);
  });

  it('names a device and keeps the name', async () => {
    const me = await person('kilo');
    const [device] = await devicesOf(me.cookie);

    const res = await api()
      .patch(`/api/auth/security/devices/${device!.id}`)
      .set('Cookie', me.cookie)
      .send({ name: 'Work laptop' })
      .expect(200);

    const named = (res.body.data.devices as { id: string; name: string | null }[]).find(
      (d) => d.id === device!.id,
    );
    expect(named!.name).toBe('Work laptop');
  });

  it('rejects a blank name but accepts null to clear it', async () => {
    const me = await person('lima');
    const [device] = await devicesOf(me.cookie);

    await api()
      .patch(`/api/auth/security/devices/${device!.id}`)
      .set('Cookie', me.cookie)
      .send({ name: '   ' })
      .expect(400);

    await api()
      .patch(`/api/auth/security/devices/${device!.id}`)
      .set('Cookie', me.cookie)
      .send({ name: null })
      .expect(200);
  });

  it('revokes one device and leaves the others alone', async () => {
    const me = await person('mike');
    const phone = await loginAs(me.email, SAFARI_IOS);

    const devices = await devicesOf(me.cookie);
    const phoneDevice = devices.find((d) => d.device === 'Safari on iOS');

    await api()
      .delete(`/api/auth/security/devices/${phoneDevice!.id}`)
      .set('Cookie', me.cookie)
      .expect(200);

    // The revoked cookie no longer authenticates.
    await api().get('/api/auth/me').set('Cookie', phone).expect(401);
    // The caller is still signed in.
    await api().get('/api/auth/me').set('Cookie', me.cookie).expect(200);
  });

  it('signs out every other device but keeps the caller', async () => {
    const me = await person('november');
    const phone = await loginAs(me.email, SAFARI_IOS);
    const mac = await loginAs(me.email, FIREFOX_MAC);

    const res = await api()
      .post('/api/auth/security/devices/revoke-others')
      .set('Cookie', mac)
      .expect(200);

    expect(res.body.data.revoked).toBeGreaterThanOrEqual(2);

    await api().get('/api/auth/me').set('Cookie', phone).expect(401);
    await api().get('/api/auth/me').set('Cookie', me.cookie).expect(401);
    await api().get('/api/auth/me').set('Cookie', mac).expect(200);
  });

  it('raises a security notification when another device is signed out', async () => {
    const me = await person('oscar');
    await loginAs(me.email, SAFARI_IOS);

    const devices = await devicesOf(me.cookie);
    const phone = devices.find((d) => d.device === 'Safari on iOS');

    await api()
      .delete(`/api/auth/security/devices/${phone!.id}`)
      .set('Cookie', me.cookie)
      .expect(200);

    const alerts = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, me.userId));

    expect(alerts.some((n) => n.type === 'security_session_revoked')).toBe(true);
  });
});

/* ========================================================================== */
/* Cross-account isolation                                                    */
/* ========================================================================== */

describe('account isolation', () => {
  it('cannot revoke another account’s session', async () => {
    const victim = await person('papa');
    const attacker = await person('quebec');

    const [victimDevice] = await devicesOf(victim.cookie);

    await api()
      .delete(`/api/auth/security/devices/${victimDevice!.id}`)
      .set('Cookie', attacker.cookie)
      .expect(404);

    // The victim is still signed in.
    await api().get('/api/auth/me').set('Cookie', victim.cookie).expect(200);
  });

  it('cannot rename another account’s session', async () => {
    const victim = await person('romeo');
    const attacker = await person('sierra');

    const [victimDevice] = await devicesOf(victim.cookie);

    await api()
      .patch(`/api/auth/security/devices/${victimDevice!.id}`)
      .set('Cookie', attacker.cookie)
      .send({ name: 'pwned' })
      .expect(404);

    const [stillNamed] = await devicesOf(victim.cookie);
    expect(stillNamed!.name).toBeNull();
  });

  it('never shows another account’s devices or history', async () => {
    const victim = await person('tango');
    await loginAs(victim.email, SAFARI_IOS);
    const attacker = await person('uniform');

    const devices = await devicesOf(attacker.cookie);
    expect(devices.every((d) => d.device !== 'Safari on iOS')).toBe(true);

    const events = await eventsOf(attacker.cookie);
    expect(events.every((e) => e.device !== 'Safari on iOS')).toBe(true);
  });

  it('refuses every security route without a session', async () => {
    const me = await person('victor');
    const [device] = await devicesOf(me.cookie);

    await api().get('/api/auth/security/devices').expect(401);
    await api().get('/api/auth/security/events').expect(401);
    await api().post('/api/auth/security/devices/revoke-others').expect(401);
    await api().delete(`/api/auth/security/devices/${device!.id}`).expect(401);
    await api()
      .patch(`/api/auth/security/devices/${device!.id}`)
      .send({ name: 'x' })
      .expect(401);
  });

  it('refuses a revoked session immediately', async () => {
    const me = await person('whiskey');
    const phone = await loginAs(me.email, SAFARI_IOS);

    const devices = await devicesOf(me.cookie);
    const phoneDevice = devices.find((d) => d.device === 'Safari on iOS');

    await api()
      .delete(`/api/auth/security/devices/${phoneDevice!.id}`)
      .set('Cookie', me.cookie)
      .expect(200);

    await api().get('/api/auth/security/devices').set('Cookie', phone).expect(401);
  });
});

/* ========================================================================== */
/* Security notifications on credential changes                               */
/* ========================================================================== */

describe('security notifications', () => {
  it('notifies on a password change', async () => {
    const me = await person('xray');

    await api()
      .post('/api/auth/profile/password')
      .set('Cookie', me.cookie)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'BrandNewPass9',
        confirmPassword: 'BrandNewPass9',
      })
      .expect(200);

    const alerts = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, me.userId));

    expect(alerts.some((n) => n.type === 'security_password_changed')).toBe(true);
  });

  it('never puts a password in the notification or the event', async () => {
    const me = await person('yankee');

    await api()
      .post('/api/auth/profile/password')
      .set('Cookie', me.cookie)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'BrandNewPass9',
        confirmPassword: 'BrandNewPass9',
      })
      .expect(200);

    const alerts = await db.select().from(notifications);
    const events = await db.select().from(accountEvents);
    const dump = JSON.stringify({ alerts, events });

    expect(dump).not.toContain('BrandNewPass9');
    expect(dump).not.toContain(PASSWORD);
  });
});
