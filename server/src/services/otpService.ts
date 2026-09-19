import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { otpChallenges, type OtpChallenge } from '../db/schema.js';
import { env } from '../config/env.js';
import { AppError, ERROR_CODES, badRequest, tooManyRequests } from '../utils/errors.js';

export type OtpPurpose = 'SIGNUP_VERIFICATION' | 'PASSWORD_RESET';

/**
 * bcrypt work factor for OTPs. Lower than for passwords: codes are verified under a
 * hard attempt cap and expire in minutes, and verify latency is user-facing.
 */
const OTP_SALT_ROUNDS = 10;

/**
 * Six digits is only ~20 bits, so a plain digest would be trivially reversible from a
 * database dump via a 10^6 lookup table. Peppering with a secret that lives outside the
 * database (OTP_HASH_SECRET) means a dump alone is not enough, and bcrypt on top makes
 * each guess expensive even if the pepper leaks too. Binding the address and purpose
 * into the HMAC stops a hash from being replayed across flows.
 */
const peppered = (otp: string, email: string, purpose: OtpPurpose): string =>
  crypto
    .createHmac('sha256', env.OTP_HASH_SECRET)
    .update(`${purpose}:${email}:${otp}`)
    .digest('hex');

/** Cryptographically secure 6-digit code. Never Math.random(). */
export const generateOtp = (): string => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

export const hashOtp = (otp: string, email: string, purpose: OtpPurpose): Promise<string> =>
  bcrypt.hash(peppered(otp, email, purpose), OTP_SALT_ROUNDS);

const compareOtp = (
  otp: string,
  email: string,
  purpose: OtpPurpose,
  hash: string,
): Promise<boolean> => bcrypt.compare(peppered(otp, email, purpose), hash);

/** The single source of truth for "is there a usable challenge right now". */
const activeChallengeWhere = (email: string, purpose: OtpPurpose) =>
  and(
    eq(otpChallenges.email, email),
    eq(otpChallenges.purpose, purpose),
    isNull(otpChallenges.consumedAt),
    isNull(otpChallenges.invalidatedAt),
  );

export const findActiveChallenge = async (
  email: string,
  purpose: OtpPurpose,
): Promise<OtpChallenge | undefined> => {
  const rows = await db
    .select()
    .from(otpChallenges)
    .where(activeChallengeWhere(email, purpose))
    .limit(1);
  return rows[0];
};

export type ChallengeTiming = {
  expiresAt: Date;
  resendAvailableAt: Date;
  /** Echoed back so the client renders a countdown without trusting its own clock. */
  serverTime: Date;
  maxAttempts: number;
};

export const toTiming = (challenge: OtpChallenge): ChallengeTiming => ({
  expiresAt: challenge.expiresAt,
  resendAvailableAt: challenge.resendAvailableAt,
  serverTime: new Date(),
  maxAttempts: env.OTP_MAX_ATTEMPTS,
});

export type IssueChallengeInput = {
  email: string;
  purpose: OtpPurpose;
  /** Signup payload parked on the challenge until verification creates the user. */
  fullName?: string | null;
  passwordHash?: string | null;
  /**
   * Delivers the code. Runs inside the transaction so a delivery failure rolls the
   * challenge back: we never leave a challenge behind for an email that never sent.
   */
  deliver: (otp: string) => Promise<void>;
};

/**
 * Issues (or re-issues) a challenge.
 *
 * Cooldown is enforced here against `resend_available_at` in Postgres, so the frontend
 * timer is only ever a display of server state.
 */
export const issueChallenge = async (input: IssueChallengeInput): Promise<ChallengeTiming> => {
  const { email, purpose } = input;
  const existing = await findActiveChallenge(email, purpose);
  const now = new Date();

  if (existing && existing.resendAvailableAt > now) {
    throw tooManyRequests(ERROR_CODES.OTP_COOLDOWN, 'Please wait before requesting another code.', {
      resendAvailableAt: existing.resendAvailableAt.toISOString(),
      serverTime: now.toISOString(),
      retryAfterSeconds: Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000),
    });
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp, email, purpose);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + env.OTP_EXPIRES_SECONDS * 1000);
  const resendAvailableAt = new Date(issuedAt.getTime() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000);

  return db.transaction(async (tx) => {
    // A resend must kill the previous code before the new one lands, both to satisfy
    // "only the newest OTP is valid" and to respect the partial unique index.
    await tx
      .update(otpChallenges)
      .set({ invalidatedAt: issuedAt })
      .where(activeChallengeWhere(email, purpose));

    const inserted = await tx
      .insert(otpChallenges)
      .values({
        email,
        purpose,
        otpHash,
        fullName: input.fullName ?? null,
        passwordHash: input.passwordHash ?? null,
        attempts: 0,
        createdAt: issuedAt,
        expiresAt,
        lastSentAt: issuedAt,
        resendAvailableAt,
      })
      .returning();

    const challenge = inserted[0];
    if (!challenge) {
      throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Could not create challenge.');
    }

    // Throwing here rolls the whole transaction back: no phantom "code sent" state.
    await input.deliver(otp);

    return toTiming(challenge);
  });
};

/**
 * Verifies and atomically consumes a challenge.
 *
 * Consumption is a single conditional UPDATE, so two concurrent requests carrying the
 * same correct code cannot both succeed: exactly one gets the row back.
 */
export const verifyAndConsumeChallenge = async (
  email: string,
  purpose: OtpPurpose,
  otp: string,
): Promise<OtpChallenge> => {
  const challenge = await findActiveChallenge(email, purpose);
  const now = new Date();

  if (!challenge) {
    throw badRequest(ERROR_CODES.OTP_NOT_FOUND, 'No active verification code. Request a new one.');
  }

  if (challenge.expiresAt <= now) {
    await db
      .update(otpChallenges)
      .set({ invalidatedAt: now })
      .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)));
    throw badRequest(ERROR_CODES.OTP_EXPIRED, 'This code has expired. Request a new one.');
  }

  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    await db
      .update(otpChallenges)
      .set({ invalidatedAt: now })
      .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)));
    throw badRequest(
      ERROR_CODES.OTP_MAX_ATTEMPTS,
      'Too many incorrect attempts. Request a new code.',
    );
  }

  const matches = await compareOtp(otp, email, purpose, challenge.otpHash);

  if (!matches) {
    const updated = await db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)))
      .returning({ attempts: otpChallenges.attempts });

    const attempts = updated[0]?.attempts ?? challenge.attempts + 1;
    const attemptsRemaining = Math.max(0, env.OTP_MAX_ATTEMPTS - attempts);

    if (attemptsRemaining === 0) {
      // Burn the challenge immediately: a spent code must be unusable, not merely counted.
      await db
        .update(otpChallenges)
        .set({ invalidatedAt: new Date() })
        .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)));
      throw badRequest(
        ERROR_CODES.OTP_MAX_ATTEMPTS,
        'Too many incorrect attempts. Request a new code.',
      );
    }

    throw badRequest(ERROR_CODES.OTP_INVALID, 'That code is not correct.', { attemptsRemaining });
  }

  const consumed = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(otpChallenges.id, challenge.id),
        isNull(otpChallenges.consumedAt),
        isNull(otpChallenges.invalidatedAt),
      ),
    )
    .returning();

  const row = consumed[0];
  if (!row) {
    // Lost the race: another request consumed or invalidated this challenge first.
    throw badRequest(ERROR_CODES.OTP_INVALID, 'This code has already been used.');
  }

  return row;
};

/** Drops any live challenge, e.g. when the user changes the email mid-signup. */
export const invalidateChallenges = async (email: string, purpose: OtpPurpose): Promise<void> => {
  await db
    .update(otpChallenges)
    .set({ invalidatedAt: new Date() })
    .where(activeChallengeWhere(email, purpose));
};
