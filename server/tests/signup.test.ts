import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { api, closeDatabase, mailbox, resetAll, sessionCookie, VALID_PASSWORD } from './helpers.js';
import { db } from '../src/db/client.js';
import { otpChallenges, users } from '../src/db/schema.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const signupBody = (email: string, password = VALID_PASSWORD) => ({
  fullName: 'Ada Lovelace',
  email,
  password,
  confirmPassword: password,
});

describe('signup: request OTP', () => {
  it('sends a code and creates NO user row yet', async () => {
    const res = await api()
      .post('/api/auth/signup/request-otp')
      .send(signupBody('ada@example.com'))
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.maskedEmail).toMatch(/^ad•+@example\.com$/);
    expect(res.body.data.resendAvailableAt).toBeTruthy();
    expect(mailbox.sent).toHaveLength(1);

    const rows = await db.select().from(users).where(eq(users.email, 'ada@example.com'));
    expect(rows).toHaveLength(0);
  });

  it('never stores the OTP in plaintext', async () => {
    await api().post('/api/auth/signup/request-otp').send(signupBody('ada@example.com')).expect(201);
    const otp = mailbox.lastOtp();

    const rows = await db.select().from(otpChallenges);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.otpHash).not.toContain(otp);
    expect(rows[0]!.otpHash.startsWith('$2')).toBe(true);
  });

  it('normalizes the email to lower case', async () => {
    await api()
      .post('/api/auth/signup/request-otp')
      .send(signupBody('ADA@Example.COM'))
      .expect(201);
    const rows = await db.select().from(otpChallenges);
    expect(rows[0]!.email).toBe('ada@example.com');
  });

  it('rejects a weak password with field-level errors', async () => {
    const res = await api()
      .post('/api/auth/signup/request-otp')
      .send(signupBody('ada@example.com', 'weak'))
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.some((f: { field: string }) => f.field === 'password')).toBe(true);
    expect(mailbox.sent).toHaveLength(0);
  });

  it('rejects a confirm-password mismatch server-side', async () => {
    const res = await api()
      .post('/api/auth/signup/request-otp')
      .send({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        password: VALID_PASSWORD,
        confirmPassword: 'Different123',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields[0].field).toBe('confirmPassword');
  });

  it('rejects a duplicate email with EMAIL_ALREADY_EXISTS', async () => {
    await api().post('/api/auth/signup/request-otp').send(signupBody('ada@example.com')).expect(201);
    await api()
      .post('/api/auth/signup/verify-otp')
      .send({ email: 'ada@example.com', otp: mailbox.lastOtp() })
      .expect(201);

    const res = await api()
      .post('/api/auth/signup/request-otp')
      .send(signupBody('ada@example.com'))
      .expect(400);

    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('creates no challenge when email delivery fails', async () => {
    mailbox.failAlways = true;

    const res = await api()
      .post('/api/auth/signup/request-otp')
      .send(signupBody('ada@example.com'))
      .expect(502);

    expect(res.body.error.code).toBe('EMAIL_DELIVERY_FAILED');
    // The transaction rolled back: no phantom "code sent" state was left behind.
    expect(await db.select().from(otpChallenges)).toHaveLength(0);
    expect(await db.select().from(users)).toHaveLength(0);
  });
});

describe('signup: verify OTP', () => {
  const email = 'ada@example.com';

  const request = async () =>
    api().post('/api/auth/signup/request-otp').send(signupBody(email)).expect(201);

  it('creates the user and an authenticated session only after verification', async () => {
    await request();
    const res = await api()
      .post('/api/auth/signup/verify-otp')
      .send({ email, otp: mailbox.lastOtp() })
      .expect(201);

    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.emailVerifiedAt).toBeTruthy();
    expect(sessionCookie(res)).toMatch(/^sw_session=/);

    const cookie = sessionCookie(res)!;
    const me = await api().get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.data.user.email).toBe(email);
  });

  it('sets the session cookie HttpOnly with SameSite=Lax', async () => {
    await request();
    const res = await api()
      .post('/api/auth/signup/verify-otp')
      .send({ email, otp: mailbox.lastOtp() })
      .expect(201);

    const raw = res.headers['set-cookie'] as unknown as string[];
    const cookie = raw.find((c) => c.startsWith('sw_session='))!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain('Path=/');
  });

  it('never stores the password in plaintext', async () => {
    await request();
    await api()
      .post('/api/auth/signup/verify-otp')
      .send({ email, otp: mailbox.lastOtp() })
      .expect(201);

    const rows = await db.select().from(users);
    expect(rows[0]!.passwordHash).not.toBe(VALID_PASSWORD);
    expect(rows[0]!.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects a wrong code and counts the attempt', async () => {
    await request();
    const res = await api()
      .post('/api/auth/signup/verify-otp')
      .send({ email, otp: '000000' })
      .expect(400);

    expect(['OTP_INVALID', 'OTP_MAX_ATTEMPTS']).toContain(res.body.error.code);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('locks the challenge after 5 incorrect attempts, even with the right code', async () => {
    await request();
    const correct = mailbox.lastOtp();
    const wrong = correct === '111111' ? '222222' : '111111';

    for (let i = 0; i < 4; i += 1) {
      const res = await api().post('/api/auth/signup/verify-otp').send({ email, otp: wrong });
      expect(res.body.error.code).toBe('OTP_INVALID');
      expect(res.body.error.details.attemptsRemaining).toBe(4 - i);
    }

    const fifth = await api().post('/api/auth/signup/verify-otp').send({ email, otp: wrong });
    expect(fifth.body.error.code).toBe('OTP_MAX_ATTEMPTS');

    // The correct code is now dead too.
    const after = await api().post('/api/auth/signup/verify-otp').send({ email, otp: correct });
    expect(after.body.error.code).toBe('OTP_NOT_FOUND');
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('rejects an expired code', async () => {
    await request();
    const otp = mailbox.lastOtp();

    await db
      .update(otpChallenges)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(otpChallenges.email, email));

    const res = await api().post('/api/auth/signup/verify-otp').send({ email, otp }).expect(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('refuses to reuse a consumed code', async () => {
    await request();
    const otp = mailbox.lastOtp();
    await api().post('/api/auth/signup/verify-otp').send({ email, otp }).expect(201);

    const replay = await api().post('/api/auth/signup/verify-otp').send({ email, otp }).expect(400);
    expect(replay.body.error.code).toBe('OTP_NOT_FOUND');
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('lets only one of two concurrent identical verifications win', async () => {
    await request();
    const otp = mailbox.lastOtp();

    const results = await Promise.all([
      api().post('/api/auth/signup/verify-otp').send({ email, otp }),
      api().post('/api/auth/signup/verify-otp').send({ email, otp }),
    ]);

    const created = results.filter((r) => r.status === 201);
    expect(created).toHaveLength(1);
    // Exactly one user row, whichever request won the race.
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('creates exactly one user under concurrent signups of the same email', async () => {
    await request();
    const otp = mailbox.lastOtp();

    await Promise.all(
      Array.from({ length: 5 }, () =>
        api().post('/api/auth/signup/verify-otp').send({ email, otp }),
      ),
    );

    expect(await db.select().from(users)).toHaveLength(1);
  });
});

describe('signup: resend and cooldown', () => {
  const email = 'ada@example.com';

  it('enforces the 120s cooldown server-side and reports when resend unlocks', async () => {
    const first = await api()
      .post('/api/auth/signup/request-otp')
      .send(signupBody(email))
      .expect(201);

    const resendAt = new Date(first.body.data.resendAvailableAt).getTime();
    const serverNow = new Date(first.body.data.serverTime).getTime();
    expect(Math.round((resendAt - serverNow) / 1000)).toBeGreaterThanOrEqual(118);
    expect(Math.round((resendAt - serverNow) / 1000)).toBeLessThanOrEqual(120);

    const blocked = await api().post('/api/auth/signup/resend-otp').send({ email }).expect(429);
    expect(blocked.body.error.code).toBe('OTP_COOLDOWN');
    expect(blocked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.headers['retry-after']).toBeTruthy();
    expect(mailbox.sent).toHaveLength(1);
  });

  it('invalidates the previous code when a resend succeeds', async () => {
    await api().post('/api/auth/signup/request-otp').send(signupBody(email)).expect(201);
    const firstOtp = mailbox.lastOtp();

    // Fast-forward the cooldown rather than waiting 120 real seconds.
    await db
      .update(otpChallenges)
      .set({ resendAvailableAt: new Date(Date.now() - 1000) })
      .where(eq(otpChallenges.email, email));

    await api().post('/api/auth/signup/resend-otp').send({ email }).expect(200);
    const secondOtp = mailbox.lastOtp();
    expect(mailbox.sent).toHaveLength(2);

    if (firstOtp !== secondOtp) {
      const stale = await api()
        .post('/api/auth/signup/verify-otp')
        .send({ email, otp: firstOtp })
        .expect(400);
      expect(stale.body.error.code).toBe('OTP_INVALID');
    }

    await api().post('/api/auth/signup/verify-otp').send({ email, otp: secondOtp }).expect(201);
  });

  it('keeps at most one live challenge per email+purpose', async () => {
    await api().post('/api/auth/signup/request-otp').send(signupBody(email)).expect(201);
    await db
      .update(otpChallenges)
      .set({ resendAvailableAt: new Date(Date.now() - 1000) })
      .where(eq(otpChallenges.email, email));
    await api().post('/api/auth/signup/resend-otp').send({ email }).expect(200);

    const live = (await db.select().from(otpChallenges)).filter(
      (c) => !c.consumedAt && !c.invalidatedAt,
    );
    expect(live).toHaveLength(1);
  });
});
