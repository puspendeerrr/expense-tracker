import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, pool } from '../src/db/client.js';
import { setEmailTransport, type EmailTransport, type OutboundEmail } from '../src/services/emailService.js';
import { rateLimitStore } from '../src/middleware/rateLimit.js';
import { isTestDatabase } from '../src/config/env.js';
import { sql } from 'drizzle-orm';

/**
 * Capture transport: tests read the OTP out of the rendered email body rather than
 * reaching into the database, which keeps them honest about what a real user receives.
 */
export class CaptureTransport implements EmailTransport {
  readonly sent: OutboundEmail[] = [];
  /** Set to make the next send fail, for the Resend-failure path. */
  failNext = false;
  failAlways = false;

  async send(message: OutboundEmail): Promise<void> {
    if (this.failNext || this.failAlways) {
      this.failNext = false;
      throw new Error('simulated provider outage');
    }
    this.sent.push(message);
  }

  get last(): OutboundEmail | undefined {
    return this.sent[this.sent.length - 1];
  }

  /** The 6-digit code is rendered into the subject line; pull it back out. */
  lastOtp(): string {
    const subject = this.last?.subject ?? '';
    const match = /\b(\d{6})\b/.exec(subject);
    if (!match?.[1]) throw new Error(`No OTP found in subject: "${subject}"`);
    return match[1];
  }

  otpFor(email: string): string {
    const message = [...this.sent].reverse().find((m) => m.to === email);
    if (!message) throw new Error(`No email captured for ${email}`);
    const match = /\b(\d{6})\b/.exec(message.subject);
    if (!match?.[1]) throw new Error('No OTP in subject');
    return match[1];
  }

  reset(): void {
    this.sent.length = 0;
    this.failNext = false;
    this.failAlways = false;
  }
}

export const mailbox = new CaptureTransport();
setEmailTransport(mailbox);

export const app: Express = createApp();
export const api = () => request(app);

/**
 * Wipes all state between tests.
 *
 * Guarded: this is a destructive TRUNCATE, and it previously ran against whatever
 * DATABASE_URL pointed at -- which meant running the suite silently deleted every
 * account in the development database. The process now refuses to proceed unless it is
 * demonstrably connected to the dedicated test database.
 */
export const resetDatabase = async (): Promise<void> => {
  if (!isTestDatabase()) {
    throw new Error(
      'Refusing to truncate: not connected to TEST_DATABASE_URL. ' +
        'Run the suite with NODE_ENV=test and a TEST_DATABASE_URL distinct from DATABASE_URL.',
    );
  }

  await db.execute(
    sql`truncate table
          "sessions", "password_reset_authorizations", "otp_challenges",
          "notifications", "activities", "settlements",
          "expense_participants", "expenses", "group_members", "groups",
          "users"
        restart identity cascade`,
  );
};

export const resetAll = async (): Promise<void> => {
  await resetDatabase();
  mailbox.reset();
  // Limits are per-process and would otherwise leak across test files.
  rateLimitStore.clear();
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};

/** Extracts the session cookie from a supertest response. */
export const sessionCookie = (res: request.Response): string | undefined => {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = list.find((value) => value.startsWith('sw_session='));
  return cookie?.split(';')[0];
};

export const VALID_PASSWORD = 'CorrectHorse9';
export const OTHER_PASSWORD = 'NewStrongPass7';

/** Signs a user all the way up and returns their session cookie. */
export const signupUser = async (
  email: string,
  password = VALID_PASSWORD,
  fullName = 'Test User',
): Promise<{ cookie: string; userId: string }> => {
  await api()
    .post('/api/auth/signup/request-otp')
    .send({ fullName, email, password, confirmPassword: password })
    .expect(201);

  const otp = mailbox.otpFor(email);
  const verify = await api()
    .post('/api/auth/signup/verify-otp')
    .send({ email, otp })
    .expect(201);

  const cookie = sessionCookie(verify);
  if (!cookie) throw new Error('signup did not set a session cookie');
  return { cookie, userId: verify.body.data.user.id as string };
};
