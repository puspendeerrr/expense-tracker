import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { auth as authApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import type { OtpChallenge } from '@/api/types';
import { useCountdown } from '@/hooks/useCountdown';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon } from '@/components/Icon';
import {
  SMButton,
  SMTextInput,
  SMPasswordInput,
  SMOTPInput,
  SMCard,
  SMHeader,
  SMInlineNotice,
  SMAuthContainer,
} from '@/components/sm';

export default function ForgotPasswordScreen() {
  const { colors, dark } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'code' | 'password' | 'done'>('email');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const resetToken = useRef<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const inFlight = useRef(false);
  const confirmRef = useRef<TextInput>(null);

  const resendIn = useCountdown(challenge?.resendAvailableAt, challenge?.serverTime);
  const problem = error ? describeError(error) : undefined;

  const run = async (fn: () => Promise<void>): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});
    try {
      await fn();
    } catch (caught: unknown) {
      setError(caught);
      if (caught instanceof ApiError && caught.fields) {
        setFieldErrors(caught.fields);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const requestCode = (): Promise<void> =>
    run(async () => {
      if (!email.trim()) {
        setFieldErrors({ email: 'Enter your email address.' });
        return;
      }
      const next = await authApi.passwordRequest(email.trim());
      setChallenge(next);
      setStep('code');
    });

  const verify = (code: string): Promise<void> =>
    run(async () => {
      if (code.length !== 6) return;
      const { resetToken: token } = await authApi.passwordVerify(
        challenge?.email ?? email.trim(),
        code,
      );
      resetToken.current = token;
      setStep('password');
    });

  const resend = (): Promise<void> =>
    run(async () => {
      if (resendIn > 0) return;
      const next = await authApi.passwordRequest(challenge?.email ?? email.trim());
      setChallenge(next);
      setOtp('');
    });

  const submitPassword = (): Promise<void> =>
    run(async () => {
      const problems: Record<string, string> = {};
      if (!password) {
        problems.password = 'Choose a new password.';
      } else if (password.length < 8) {
        problems.password = 'Password must be at least 8 characters.';
      }
      if (password !== confirmPassword) {
        problems.confirmPassword = 'The passwords do not match.';
      }

      if (Object.keys(problems).length > 0) {
        setFieldErrors(problems);
        return;
      }

      if (!resetToken.current) {
        setStep('email');
        return;
      }

      await authApi.passwordReset({
        resetToken: resetToken.current,
        password,
        confirmPassword,
      });

      resetToken.current = null;
      setPassword('');
      setConfirmPassword('');
      setStep('done');
    });

  const handleBack = (): void => {
    setError(undefined);
    if (step === 'code') setStep('email');
    else if (step === 'password') setStep('code');
    else if (step === 'done') router.replace('/sign-in');
    else router.back();
  };

  const stepLabels = {
    email: 'STEP 1 OF 4',
    code: 'STEP 2 OF 4',
    password: 'STEP 3 OF 4',
    done: 'STEP 4 OF 4',
  };

  return (
    <SMAuthContainer>
      {/* Top Header */}
      <SMHeader
        onBack={step !== 'done' ? handleBack : undefined}
        stepText={stepLabels[step]}
      />

      {step === 'email' ? (
        <>
          <View style={styles.heroBlock}>
            <Text
              accessibilityRole="header"
              style={[styles.headline, { color: colors.text }]}
            >
              Reset password
            </Text>
            <Text style={[styles.subheadline, { color: colors.muted }]}>
              Enter the email associated with your SplitMoney account, and we will send you a verification code.
            </Text>
          </View>

          <SMCard elevated>
            <SMTextInput
              label="Email Address"
              leftIcon="mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
              }}
              error={fieldErrors.email}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="go"
              blurOnSubmit={true}
              editable={!submitting}
              onSubmitEditing={() => void requestCode()}
            />

            {problem ? (
              <SMInlineNotice
                type="error"
                title={problem.title}
                message={problem.message}
              />
            ) : null}

            <SMButton
              label="Send Verification Code"
              loadingLabel="Sending code…"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={() => void requestCode()}
              style={styles.submitBtn}
            />
          </SMCard>
        </>
      ) : step === 'code' ? (
        <>
          <View style={styles.heroBlock}>
            <Text
              accessibilityRole="header"
              style={[styles.headline, { color: colors.text }]}
            >
              Enter verification code
            </Text>
            <Text style={[styles.subheadline, { color: colors.muted }]}>
              We sent a 6-digit code to{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {challenge?.email ?? email.trim()}
              </Text>
              . Enter it below to proceed.
            </Text>
          </View>

          <SMCard elevated>
            <SMOTPInput
              value={otp}
              onChange={(code) => {
                setOtp(code);
                if (error) setError(undefined);
              }}
              onComplete={(code) => void verify(code)}
              disabled={submitting}
            />

            {problem ? (
              <SMInlineNotice
                type="error"
                title={problem.title}
                message={problem.message}
              />
            ) : null}

            <SMButton
              label="Verify Code"
              loadingLabel="Verifying code…"
              variant="primary"
              size="lg"
              disabled={otp.length !== 6}
              loading={submitting}
              onPress={() => void verify(otp)}
              style={styles.submitBtn}
            />

            <View style={styles.resendBlock}>
              {resendIn > 0 ? (
                <Text style={[styles.resendTimer, { color: colors.muted }]}>
                  Resend code in <Text style={{ color: colors.text, fontWeight: '700' }}>{resendIn}s</Text>
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Resend password reset verification code"
                  onPress={() => void resend()}
                  disabled={submitting}
                  hitSlop={12}
                >
                  <Text style={[styles.resendAction, { color: colors.primary }]}>
                    Resend code
                  </Text>
                </Pressable>
              )}
            </View>
          </SMCard>
        </>
      ) : step === 'password' ? (
        <>
          <View style={styles.heroBlock}>
            <Text
              accessibilityRole="header"
              style={[styles.headline, { color: colors.text }]}
            >
              Set new password
            </Text>
            <Text style={[styles.subheadline, { color: colors.muted }]}>
              Choose a strong, secure password with at least 8 characters.
            </Text>
          </View>

          <SMCard elevated>
            <SMPasswordInput
              label="New Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
              }}
              error={fieldErrors.password}
              showStrengthHint
              placeholder="At least 8 characters"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              blurOnSubmit={false}
              editable={!submitting}
              onSubmitEditing={() => confirmRef.current?.focus()}
            />

            <SMPasswordInput
              ref={confirmRef}
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
              error={fieldErrors.confirmPassword}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              blurOnSubmit={true}
              editable={!submitting}
              onSubmitEditing={() => void submitPassword()}
            />

            {problem ? (
              <SMInlineNotice
                type="error"
                title={problem.title}
                message={problem.message}
              />
            ) : null}

            <SMButton
              label="Update Password"
              loadingLabel="Updating password…"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={() => void submitPassword()}
              style={styles.submitBtn}
            />
          </SMCard>
        </>
      ) : (
        /* Step 4: Success / Confirmation */
        <SMCard elevated style={styles.doneCard}>
          <View
            style={[
              styles.doneBadge,
              {
                backgroundColor: dark ? '#064E3B55' : '#ECFDF5',
                borderColor: dark ? '#065F46' : '#A7F3D0',
              },
              !dark ? shadows.sm : null,
            ]}
          >
            <Icon name="check" size={32} tone="primary" />
          </View>

          <Text
            accessibilityRole="header"
            style={[styles.doneTitle, { color: colors.text }]}
          >
            Password updated
          </Text>

          <Text style={[styles.doneDescription, { color: colors.muted }]}>
            Your SplitMoney password has been changed successfully. For security, all other sessions have been signed out. Please sign in with your new password.
          </Text>

          <SMButton
            label="Continue to Sign In"
            variant="primary"
            size="lg"
            onPress={() => router.replace('/sign-in')}
            style={styles.doneBtn}
          />
        </SMCard>
      )}
    </SMAuthContainer>
  );
}

const styles = StyleSheet.create({
  heroBlock: {
    gap: spacing.xs,
    width: '100%',
  },
  headline: {
    fontSize: typography.hero,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: typography.bodySm,
    lineHeight: 22,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  resendBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  resendTimer: {
    fontSize: typography.caption,
    fontWeight: '500',
  },
  resendAction: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  doneCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.base,
  },
  doneBadge: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  doneTitle: {
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  doneDescription: {
    fontSize: typography.bodySm,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  doneBtn: {
    width: '100%',
    marginTop: spacing.md,
  },
});
