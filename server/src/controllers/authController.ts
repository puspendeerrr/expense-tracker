import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, type User } from '../db/schema.js';
import { env } from '../config/env.js';
import { ERROR_CODES, AppError, badRequest, forbidden, unauthorized } from '../utils/errors.js';
import { sendOk } from '../utils/http.js';
import { logger, redactEmail } from '../utils/logger.js';
import { hashPassword, verifyPassword, burnPasswordComparison } from '../services/passwordService.js';
import {
  findActiveChallenge,
  invalidateChallenges,
  issueChallenge,
  toTiming,
  verifyAndConsumeChallenge,
  type ChallengeTiming,
} from '../services/otpService.js';
import {
  sendPasswordResetOtp,
  sendSignupVerificationOtp,
} from '../services/emailService.js';
import {
  clearSessionCookie,
  createSession,
  revokeAllSessionsForUser,
  revokeSession,
} from '../services/sessionService.js';
import {
  consumeResetAuthorization,
  issueResetAuthorization,
  revokeResetAuthorizations,
} from '../services/passwordResetService.js';
import { validated } from '../middleware/validate.js';
import * as securityService from '../services/securityService.js';
import { getEffectivePermissions } from '../services/permissionService.js';
import { isUniqueViolation } from '../utils/dbErrors.js';
import {
  changePasswordSchema,
  loginSchema,
  passwordRequestOtpSchema,
  passwordResetSchema,
  passwordVerifyOtpSchema,
  signupRequestOtpSchema,
  signupResendOtpSchema,
  signupVerifyOtpSchema,
  updateProfileSchema,
} from '../validation/authSchemas.js';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** `jonathan@example.com` -> `jo••••••@example.com`, for the "we sent a code to…" line. */
const maskEmail = (email: string): string => {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}${'•'.repeat(Math.max(3, local.length - keep))}${domain}`;
};

const publicUser = (user: User) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  upiId: user.upiId ?? null,
  qrCodeUrl: user.qrCodeUrl ?? null,
  status: user.status,
  emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
});

/** Everything the OTP screen needs to drive its own countdowns from server time. */
const challengePayload = (email: string, timing: ChallengeTiming) => ({
  email,
  maskedEmail: maskEmail(email),
  expiresAt: timing.expiresAt.toISOString(),
  resendAvailableAt: timing.resendAvailableAt.toISOString(),
  serverTime: timing.serverTime.toISOString(),
  maxAttempts: timing.maxAttempts,
});

const findUserByEmail = async (email: string): Promise<User | undefined> => {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
};

// Uses the shared helper, which walks the cause chain -- Drizzle wraps driver errors,
// so a direct `error.code` check silently never matches and a losing concurrent signup
// would surface as a 500 instead of EMAIL_ALREADY_EXISTS.

/* -------------------------------------------------------------------------- */
/* Signup                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Step 1 of signup. Validates, parks the credentials on a challenge and emails a code.
 * No `users` row is written here -- an unverified address never becomes an account.
 */
export const signupRequestOtp = async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, password } = validated(req, signupRequestOtpSchema);

  if (await findUserByEmail(email)) {
    throw badRequest(ERROR_CODES.EMAIL_ALREADY_EXISTS, 'An account with this email already exists.');
  }

  const passwordHash = await hashPassword(password);

  const timing = await issueChallenge({
    email,
    purpose: 'SIGNUP_VERIFICATION',
    fullName,
    passwordHash,
    deliver: (otp) => sendSignupVerificationOtp(email, otp),
  });

  logger.info('signup.otp_requested', { email: redactEmail(email) });
  sendOk(res, challengePayload(email, timing), 201);
};

/**
 * Resends the signup code. Reuses the credentials already parked on the live challenge,
 * so the client never has to hold the password to ask for another code.
 */
export const signupResendOtp = async (req: Request, res: Response): Promise<void> => {
  const { email } = validated(req, signupResendOtpSchema);

  if (await findUserByEmail(email)) {
    throw badRequest(ERROR_CODES.EMAIL_ALREADY_EXISTS, 'An account with this email already exists.');
  }

  const existing = await findActiveChallenge(email, 'SIGNUP_VERIFICATION');
  if (!existing) {
    throw badRequest(
      ERROR_CODES.OTP_NOT_FOUND,
      'Your signup session expired. Please start again.',
    );
  }

  const timing = await issueChallenge({
    email,
    purpose: 'SIGNUP_VERIFICATION',
    fullName: existing.fullName,
    passwordHash: existing.passwordHash,
    deliver: (otp) => sendSignupVerificationOtp(email, otp),
  });

  logger.info('signup.otp_resent', { email: redactEmail(email) });
  sendOk(res, challengePayload(email, timing));
};

/**
 * Step 2 of signup: the only place a `users` row is created. The challenge is consumed
 * atomically first, so a replayed or concurrent request cannot create a second account.
 */
export const signupVerifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = validated(req, signupVerifyOtpSchema);

  const challenge = await verifyAndConsumeChallenge(email, 'SIGNUP_VERIFICATION', otp);

  if (!challenge.fullName || !challenge.passwordHash) {
    throw badRequest(ERROR_CODES.OTP_NOT_FOUND, 'Your signup session expired. Please start again.');
  }

  let user: User;
  try {
    const inserted = await db
      .insert(users)
      .values({
        fullName: challenge.fullName,
        email,
        passwordHash: challenge.passwordHash,
        emailVerifiedAt: new Date(),
      })
      .returning();
    user = inserted[0]!;
  } catch (error: unknown) {
    // The unique index is the real race guard: if a parallel signup won, we surface a
    // clean conflict rather than a driver error.
    if (isUniqueViolation(error)) {
      throw badRequest(
        ERROR_CODES.EMAIL_ALREADY_EXISTS,
        'An account with this email already exists.',
      );
    }
    throw error;
  }

  const signupSession = await createSession(res, user.id, req);

  // Recorded so the very first device counts as known; otherwise the next sign-in from
  // the same browser would be reported as a new device.
  await securityService.recordEvent({
    userId: user.id,
    type: 'login_succeeded',
    sessionId: signupSession.id,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    deviceSignature: securityService.deviceSignature(req.get('user-agent')),
  });

  logger.info('signup.completed', { userId: user.id });
  sendOk(res, { user: publicUser(user) }, 201);
};

/* -------------------------------------------------------------------------- */
/* Login / session                                                            */
/* -------------------------------------------------------------------------- */

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = validated(req, loginSchema);

  const user = await findUserByEmail(email);

  if (!user) {
    // Spend comparable time so response latency does not distinguish "no such user"
    // from "wrong password".
    await burnPasswordComparison();
    throw unauthorized(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password.');
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    // Recorded only for addresses that belong to a real account, so the table never
    // fills with attacker-supplied strings no one can be shown.
    await securityService.recordFailedLogin({
      userId: user.id,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
    throw unauthorized(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password.');
  }

  // Checked only after the password verifies. Telling someone their account is disabled
  // is helpful, but doing so before authentication would let anyone probe which
  // addresses exist and which are locked.
  if (user.status === 'disabled') {
    logger.warn('login.disabled_account', { userId: user.id });
    throw forbidden(
      ERROR_CODES.ACCOUNT_DISABLED,
      user.disabledReason?.trim()
        ? `This account has been disabled: ${user.disabledReason.trim()}`
        : 'This account has been disabled. Contact an administrator.',
    );
  }

  const session = await createSession(res, user.id, req);

  // Writes the login event and, when the device is unfamiliar, raises the new-device
  // notification. Awaited so the history is durable before the caller is told it
  // succeeded; it swallows its own failures, so it cannot fail the login.
  await securityService.recordLogin({
    userId: user.id,
    sessionId: session.id,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });

  logger.info('login.success', { userId: user.id });
  sendOk(res, { user: publicUser(user) });
};

/**
 * Current session, including the caller's effective permissions.
 *
 * The client uses these only to decide what to show. Every capability is enforced
 * again server-side on the route itself, so hiding a button is a courtesy, never a
 * control.
 */
export const me = async (req: Request, res: Response): Promise<void> => {
  const { permissions } = await getEffectivePermissions(req.user!.id);
  sendOk(res, { user: publicUser(req.user!), permissions });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  if (req.sessionId) {
    await revokeSession(req.sessionId);
    if (req.user) {
      await securityService.recordEvent({
        userId: req.user.id,
        type: 'logout',
        sessionId: req.sessionId,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      });
    }
  }
  clearSessionCookie(res);
  sendOk(res, { loggedOut: true });
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const data = validated(req, updateProfileSchema);

  const updateSet: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.fullName !== undefined) {
    updateSet.fullName = data.fullName;
  }
  if (data.upiId !== undefined) {
    updateSet.upiId = data.upiId === '' ? null : data.upiId;
  }
  if (data.qrCodeUrl !== undefined) {
    updateSet.qrCodeUrl = data.qrCodeUrl === '' ? null : data.qrCodeUrl;
  }

  const [updatedUser] = await db
    .update(users)
    .set(updateSet)
    .where(eq(users.id, userId))
    .returning();

  if (!updatedUser) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found.');
  }

  logger.info('profile.updated', { userId });
  sendOk(res, { user: publicUser(updatedUser) });
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = validated(req, changePasswordSchema);

  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!currentUser) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found.');
  }

  const isCurrentValid = await verifyPassword(currentPassword, currentUser.passwordHash);
  if (!isCurrentValid) {
    throw badRequest(ERROR_CODES.INVALID_CREDENTIALS, 'Current password is not correct.');
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await securityService.recordEvent({
    userId,
    type: 'password_changed',
    sessionId: req.sessionId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });

  await securityService.notifySecurity(userId, {
    type: 'security_password_changed',
    title: 'Your password was changed',
    message:
      'The password on your account was changed. If this was not you, reset it and sign out every device.',
  });

  logger.info('password.changed', { userId });
  sendOk(res, { passwordChanged: true });
};


/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Step 1 of reset. Always responds identically whether or not the address exists.
 *
 * A challenge is minted either way: that keeps the cooldown timings, response shape and
 * subsequent error behaviour indistinguishable. For an unknown address the code is
 * simply never delivered, so it cannot be redeemed.
 */
export const passwordRequestOtp = async (req: Request, res: Response): Promise<void> => {
  const { email } = validated(req, passwordRequestOtpSchema);
  const user = await findUserByEmail(email);

  const timing = await issueChallenge({
    email,
    purpose: 'PASSWORD_RESET',
    deliver: async (otp) => {
      if (user) await sendPasswordResetOtp(email, otp);
    },
  });

  logger.info('password_reset.otp_requested', {
    email: redactEmail(email),
    delivered: Boolean(user),
  });
  sendOk(res, challengePayload(email, timing));
};

/**
 * Step 2 of reset. Exchanges a verified code for a short-lived, single-use
 * authorization. Without this token `/password/reset` cannot be used at all.
 */
export const passwordVerifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = validated(req, passwordVerifyOtpSchema);

  await verifyAndConsumeChallenge(email, 'PASSWORD_RESET', otp);

  const user = await findUserByEmail(email);
  if (!user) {
    // Only reachable by guessing a never-delivered code for an unknown address.
    throw badRequest(ERROR_CODES.OTP_INVALID, 'That code is not correct.');
  }

  const authorization = await issueResetAuthorization(user.id);

  logger.info('password_reset.otp_verified', { userId: user.id });
  sendOk(res, {
    resetToken: authorization.token,
    expiresAt: authorization.expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
  });
};

/**
 * Step 3 of reset. Consumes the authorization, sets the new password and revokes every
 * existing session, so a password change also evicts anyone already signed in.
 */
export const passwordReset = async (req: Request, res: Response): Promise<void> => {
  const { resetToken, password } = validated(req, passwordResetSchema);

  const authorization = await consumeResetAuthorization(resetToken);
  const passwordHash = await hashPassword(password);

  const updated = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, authorization.userId))
    .returning();

  const user = updated[0];
  if (!user) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Account not found.');
  }

  await Promise.all([
    revokeAllSessionsForUser(user.id),
    revokeResetAuthorizations(user.id),
    invalidateChallenges(user.email, 'PASSWORD_RESET'),
  ]);

  await securityService.recordEvent({
    userId: user.id,
    type: 'password_reset',
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });

  // The reset already revoked every session, so this notification is waiting in the
  // inbox the next time they sign in -- which is exactly when they would want to see it
  // if the reset was not theirs.
  await securityService.notifySecurity(user.id, {
    type: 'security_password_changed',
    title: 'Your password was reset',
    message:
      'Your password was reset and every device was signed out. If this was not you, reset it again immediately.',
  });

  clearSessionCookie(res);
  logger.info('password_reset.completed', { userId: user.id });
  sendOk(res, { passwordReset: true });
};

/* -------------------------------------------------------------------------- */
/* Policy (so the client can render rules without hard-coding them twice)      */
/* -------------------------------------------------------------------------- */

export const authPolicy = async (_req: Request, res: Response): Promise<void> => {
  sendOk(res, {
    otpLength: 6,
    otpExpiresSeconds: env.OTP_EXPIRES_SECONDS,
    otpResendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
  });
};
