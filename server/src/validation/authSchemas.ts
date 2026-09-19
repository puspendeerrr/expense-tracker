import { z } from 'zod';

/**
 * Centralized validation rules. The frontend mirrors these messages, but the server is
 * always the authority -- nothing here relies on client-side checks having run.
 */

/** Lower-cased and trimmed so the DB unique index sees one canonical form per address. */
export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const fullNameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be at most 80 characters');

export const otpSchema = z
  .string({ required_error: 'Verification code is required' })
  .trim()
  .regex(/^[0-9]{6}$/, 'Enter the 6-digit code');

/** Confirm-password is enforced server-side too, not only in the browser. */
const withPasswordConfirmation = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .refine(
      (data) =>
        (data as { password: string; confirmPassword: string }).password ===
        (data as { confirmPassword: string }).confirmPassword,
      { path: ['confirmPassword'], message: 'Passwords do not match' },
    );

export const signupRequestOtpSchema = withPasswordConfirmation({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'Confirm your password' }),
});

export const signupVerifyOtpSchema = z
  .object({ email: emailSchema, otp: otpSchema })
  .strict();

export const signupResendOtpSchema = z.object({ email: emailSchema }).strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    // Deliberately not `passwordSchema`: rejecting a weak password here would tell an
    // attacker their guess failed policy rather than failed authentication.
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  })
  .strict();

export const passwordRequestOtpSchema = z.object({ email: emailSchema }).strict();

export const passwordVerifyOtpSchema = z
  .object({ email: emailSchema, otp: otpSchema })
  .strict();

export const passwordResetSchema = withPasswordConfirmation({
  resetToken: z
    .string({ required_error: 'Reset session is missing' })
    .trim()
    .min(1, 'Reset session is missing')
    .max(512),
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'Confirm your password' }),
});

export const upiIdSchema = z
  .string()
  .trim()
  .refine(
    (val) => val === '' || /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(val),
    { message: 'Enter a valid UPI ID (e.g. username@bank)' },
  )
  .nullable()
  .optional();

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    upiId: upiIdSchema,
    qrCodeUrl: z.string().trim().nullable().optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string({ required_error: 'Confirm your new password' }),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'New passwords do not match',
  });

export type SignupRequestOtpInput = z.infer<typeof signupRequestOtpSchema>;
export type SignupVerifyOtpInput = z.infer<typeof signupVerifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

