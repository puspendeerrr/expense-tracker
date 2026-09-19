import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { emailKey, rateLimit } from '../middleware/rateLimit.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import {
  authPolicy,
  changePassword,
  login,
  logout,
  me,
  passwordRequestOtp,
  passwordReset,
  passwordVerifyOtp,
  signupRequestOtp,
  signupResendOtp,
  signupVerifyOtp,
  updateProfile,
} from '../controllers/authController.js';
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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Two limiters per sensitive endpoint: one keyed by IP (stops one host spraying many
 * addresses) and one keyed by email (stops many hosts targeting one address). Both run
 * after validation so the email key is already normalized.
 */
const ipLimit = (name: string, max: number, windowMs: number, message?: string) =>
  rateLimit({ name: `${name}:ip`, max, windowMs, ...(message ? { message } : {}) });

const emailLimit = (name: string, max: number, windowMs: number, message?: string) =>
  rateLimit({ name: `${name}:email`, max, windowMs, keyBy: emailKey, ...(message ? { message } : {}) });

const router = Router();

router.get('/policy', asyncHandler(authPolicy));

/* ---- Signup ---- */

router.post(
  '/signup/request-otp',
  ipLimit('signup_request', 10, HOUR),
  validateBody(signupRequestOtpSchema),
  emailLimit('signup_request', 5, HOUR, 'Too many signup attempts for this email. Try again later.'),
  asyncHandler(signupRequestOtp),
);

router.post(
  '/signup/resend-otp',
  ipLimit('signup_resend', 10, HOUR),
  validateBody(signupResendOtpSchema),
  emailLimit('signup_resend', 5, HOUR, 'Too many codes requested for this email. Try again later.'),
  asyncHandler(signupResendOtp),
);

router.post(
  '/signup/verify-otp',
  ipLimit('signup_verify', 30, 15 * MINUTE),
  validateBody(signupVerifyOtpSchema),
  emailLimit('signup_verify', 15, 15 * MINUTE, 'Too many verification attempts. Try again later.'),
  asyncHandler(signupVerifyOtp),
);

/* ---- Login ---- */

router.post(
  '/login',
  ipLimit('login', 30, 15 * MINUTE),
  validateBody(loginSchema),
  emailLimit('login', 10, 15 * MINUTE, 'Too many sign-in attempts. Try again later.'),
  asyncHandler(login),
);

/* ---- Password reset ---- */

router.post(
  '/password/request-otp',
  ipLimit('password_request', 10, HOUR),
  validateBody(passwordRequestOtpSchema),
  emailLimit('password_request', 5, HOUR, 'Too many reset codes requested. Try again later.'),
  asyncHandler(passwordRequestOtp),
);

router.post(
  '/password/verify-otp',
  ipLimit('password_verify', 30, 15 * MINUTE),
  validateBody(passwordVerifyOtpSchema),
  emailLimit('password_verify', 15, 15 * MINUTE, 'Too many verification attempts. Try again later.'),
  asyncHandler(passwordVerifyOtp),
);

router.post(
  '/password/reset',
  ipLimit('password_reset', 20, HOUR),
  validateBody(passwordResetSchema),
  asyncHandler(passwordReset),
);

/* ---- Session ---- */

router.get('/me', asyncHandler(loadSession), requireAuth, asyncHandler(me));
router.post('/logout', asyncHandler(loadSession), asyncHandler(logout));

/* ---- Profile & Password (Authenticated) ---- */

router.patch(
  '/profile',
  asyncHandler(loadSession),
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(updateProfile),
);

router.post(
  '/profile/password',
  asyncHandler(loadSession),
  requireAuth,
  ipLimit('change_password', 20, HOUR),
  validateBody(changePasswordSchema),
  asyncHandler(changePassword),
);

export default router;

