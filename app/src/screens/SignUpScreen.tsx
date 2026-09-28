import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { auth as authApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import type { OtpChallenge } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { useCountdown } from '@/hooks/useCountdown';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import {
  SMButton,
  SMTextInput,
  SMPasswordInput,
  SMOTPInput,
  SMCard,
  SMHeader,
  SMInlineNotice,
  SMAuthContainer,
  SMAuthFooter,
} from '@/components/sm';

export default function SignUpScreen() {
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<'details' | 'code'>('details');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const inFlight = useRef(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const resendIn = useCountdown(challenge?.resendAvailableAt, challenge?.serverTime);
  const problem = error ? describeError(error) : undefined;

  const requestCode = async (): Promise<void> => {
    if (inFlight.current) return;

    const problems: Record<string, string> = {};
    if (!fullName.trim()) problems.fullName = 'Enter your name.';
    if (!email.trim()) problems.email = 'Enter your email address.';
    if (!password) problems.password = 'Choose a password.';
    else if (password.length < 8) problems.password = 'Password must be at least 8 characters.';
    else if (password !== confirmPassword) problems.confirmPassword = 'The passwords do not match.';

    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});

    try {
      const next = await authApi.signUpRequest({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      setChallenge(next);
      setStep('code');
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

  const verify = async (code: string): Promise<void> => {
    if (inFlight.current || code.length !== 6) return;

    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);

    try {
      await authApi.signUpVerify(challenge?.email ?? email.trim(), code);
      await refresh();
    } catch (caught: unknown) {
      setError(caught);
      setOtp('');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const resend = async (): Promise<void> => {
    if (inFlight.current || resendIn > 0) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      const next = await authApi.signUpResend(challenge?.email ?? email.trim());
      setChallenge(next);
      setOtp('');
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'code') {
      setStep('details');
      setError(undefined);
    } else {
      router.back();
    }
  };

  return (
    <SMAuthContainer>
      {/* Top Header Navigation */}
      <SMHeader
        onBack={handleBack}
        stepText={step === 'details' ? 'STEP 1 OF 2' : 'STEP 2 OF 2'}
      />

      {step === 'details' ? (
        <>
          {/* Hero text */}
          <View style={styles.heroBlock}>
            <Text
              accessibilityRole="header"
              style={[styles.headline, { color: colors.text }]}
            >
              Create account
            </Text>
            <Text style={[styles.subheadline, { color: colors.muted }]}>
              Join SplitMoney to easily split bills, track balances, and settle debts with friends.
            </Text>
          </View>

          {/* Form card */}
          <SMCard elevated>
            <SMTextInput
              label="Full Name"
              leftIcon="person"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: '' }));
              }}
              error={fieldErrors.fullName}
              placeholder="Rahul Sharma"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              blurOnSubmit={false}
              editable={!submitting}
              onSubmitEditing={() => emailRef.current?.focus()}
            />

            <SMTextInput
              ref={emailRef}
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
              returnKeyType="next"
              blurOnSubmit={false}
              editable={!submitting}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <SMPasswordInput
              ref={passwordRef}
              label="Password"
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
              label="Confirm Password"
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
              label="Continue"
              loadingLabel="Creating account…"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={() => void requestCode()}
              style={styles.submitBtn}
            />
          </SMCard>

          <SMAuthFooter
            promptText="Already have an account?"
            actionText="Sign In"
            onPress={() => router.replace('/sign-in')}
          />
        </>
      ) : (
        <>
          {/* OTP Verification Step */}
          <View style={styles.heroBlock}>
            <Text
              accessibilityRole="header"
              style={[styles.headline, { color: colors.text }]}
            >
              Verify your email
            </Text>
            <Text style={[styles.subheadline, { color: colors.muted }]}>
              We emailed a 6-digit verification code to{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {challenge?.email ?? email.trim()}
              </Text>
              . Enter it below to complete registration.
            </Text>
          </View>

          <SMCard elevated>
            <SMOTPInput
              value={otp}
              onChange={(next) => {
                setOtp(next);
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
              label="Verify & Complete Sign Up"
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
                  accessibilityLabel="Resend verification code"
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
});
