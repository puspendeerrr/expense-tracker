import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  api,
  closeDatabase,
  mailbox,
  OTHER_PASSWORD,
  resetAll,
  sessionCookie,
  signupUser,
  VALID_PASSWORD,
} from './helpers.js';
import { db } from '../src/db/client.js';
import { otpChallenges, passwordResetAuthorizations, sessions, users } from '../src/db/schema.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const EMAIL = 'ada.reset@example.com';

describe('password reset: request OTP', () => {
  it('returns indistinguishable response for existing and non-existing email (no enumeration)', async () => {
    await signupUser(EMAIL);
    mailbox.reset();

    const existingRes = await api()
      .post('/api/auth/password/request-otp')
      .send({ email: EMAIL })
      .expect(200);

    expect(existingRes.body.ok).toBe(true);
    expect(existingRes.body.data.maskedEmail).toMatch(/^ad•+@example\.com$/);
    expect(existingRes.body.data.resendAvailableAt).toBeTruthy();
    expect(mailbox.sent).toHaveLength(1);

    mailbox.reset();

    const unknownEmail = 'unknown@example.com';
    const unknownRes = await api()
      .post('/api/auth/password/request-otp')
      .send({ email: unknownEmail })
      .expect(200);

    expect(unknownRes.body.ok).toBe(true);
    expect(unknownRes.body.data.maskedEmail).toMatch(/^un•+@example\.com$/);
    expect(unknownRes.body.data.resendAvailableAt).toBeTruthy();
    // For an unknown user, no email is delivered so code cannot be redeemed
    expect(mailbox.sent).toHaveLength(0);
  });

  it('enforces 120s resend cooldown on password reset OTP', async () => {
    await signupUser(EMAIL);

    await api()
      .post('/api/auth/password/request-otp')
      .send({ email: EMAIL })
      .expect(200);

    const blocked = await api()
      .post('/api/auth/password/request-otp')
      .send({ email: EMAIL })
      .expect(429);

    expect(blocked.body.error.code).toBe('OTP_COOLDOWN');
    expect(blocked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('password reset: verify OTP', () => {
  beforeEach(async () => {
    await signupUser(EMAIL);
    mailbox.reset();
    await api().post('/api/auth/password/request-otp').send({ email: EMAIL }).expect(200);
  });

  it('verifies correct OTP and returns a short-lived reset authorization token', async () => {
    const otp = mailbox.otpFor(EMAIL);
    const res = await api()
      .post('/api/auth/password/verify-otp')
      .send({ email: EMAIL, otp })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.resetToken).toBeTruthy();
    expect(res.body.data.expiresAt).toBeTruthy();

    const rows = await db.select().from(passwordResetAuthorizations);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.consumedAt).toBeNull();
  });

  it('rejects incorrect OTP and counts attempts', async () => {
    const res = await api()
      .post('/api/auth/password/verify-otp')
      .send({ email: EMAIL, otp: '000000' })
      .expect(400);

    expect(res.body.error.code).toBe('OTP_INVALID');
    expect(res.body.error.details.attemptsRemaining).toBe(4);
  });

  it('locks OTP after 5 incorrect attempts', async () => {
    const correct = mailbox.otpFor(EMAIL);
    const wrong = correct === '111111' ? '222222' : '111111';

    for (let i = 0; i < 4; i += 1) {
      const res = await api()
        .post('/api/auth/password/verify-otp')
        .send({ email: EMAIL, otp: wrong })
        .expect(400);
      expect(res.body.error.code).toBe('OTP_INVALID');
    }

    const fifth = await api()
      .post('/api/auth/password/verify-otp')
      .send({ email: EMAIL, otp: wrong })
      .expect(400);
    expect(fifth.body.error.code).toBe('OTP_MAX_ATTEMPTS');

    // Correct OTP is now locked
    const after = await api()
      .post('/api/auth/password/verify-otp')
      .send({ email: EMAIL, otp: correct })
      .expect(400);
    expect(after.body.error.code).toBe('OTP_NOT_FOUND');
  });

  it('refuses to verify an expired OTP', async () => {
    const otp = mailbox.otpFor(EMAIL);

    await db
      .update(otpChallenges)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(otpChallenges.email, EMAIL));

    const res = await api()
      .post('/api/auth/password/verify-otp')
      .send({ email: EMAIL, otp })
      .expect(400);

    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });
});

describe('password reset: execute reset', () => {
  let resetToken: string;
  let originalCookie: string;

  beforeEach(async () => {
    const user = await signupUser(EMAIL);
    originalCookie = user.cookie;
    mailbox.reset();

    await api().post('/api/auth/password/request-otp').send({ email: EMAIL }).expect(200);
    const otp = mailbox.otpFor(EMAIL);

    const verify = await api()
      .post('/api/auth/password/verify-otp')
      .send({ email: EMAIL, otp })
      .expect(200);

    resetToken = verify.body.data.resetToken;
  });

  it('updates password and allows login with the new password', async () => {
    const res = await api()
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        password: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.passwordReset).toBe(true);

    // Old password fails
    await api()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: VALID_PASSWORD })
      .expect(401);

    // New password succeeds
    const loginRes = await api()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: OTHER_PASSWORD })
      .expect(200);

    expect(loginRes.body.data.user.email).toBe(EMAIL);
    expect(sessionCookie(loginRes)).toBeTruthy();
  });

  it('evicts all existing active sessions upon password reset', async () => {
    // Before reset: original session works
    await api().get('/api/auth/me').set('Cookie', originalCookie).expect(200);

    // Reset password
    await api()
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        password: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
      .expect(200);

    // After reset: original session cookie is revoked
    await api().get('/api/auth/me').set('Cookie', originalCookie).expect(401);

    const userRows = await db.select().from(users).where(eq(users.email, EMAIL));
    const activeSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userRows[0]!.id));

    expect(activeSessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('prevents reusing a consumed reset authorization token', async () => {
    await api()
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        password: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
      .expect(200);

    const replay = await api()
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        password: 'AnotherPassword8',
        confirmPassword: 'AnotherPassword8',
      })
      .expect(400);

    expect(replay.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects an expired reset authorization token', async () => {
    await db
      .update(passwordResetAuthorizations)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    const res = await api()
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        password: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
      .expect(400);

    expect(res.body.error.code).toBe('RESET_TOKEN_EXPIRED');
  });

  it('validates password strength and confirmation on reset', async () => {
    const weakRes = await api()
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        password: 'weak',
        confirmPassword: 'weak',
      })
      .expect(400);

    expect(weakRes.body.error.code).toBe('VALIDATION_ERROR');

    const mismatchRes = await api()
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        password: OTHER_PASSWORD,
        confirmPassword: 'DifferentPassword1',
      })
      .expect(400);

    expect(mismatchRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(mismatchRes.body.error.fields[0].field).toBe('confirmPassword');
  });
});

