import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth as authApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import type { OtpChallenge } from '@/api/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { OtpInput } from '@/components/OtpInput';
import { Icon } from '@/components/Icon';
import { useCountdown } from '@/hooks/useCountdown';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

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
      if (caught instanceof ApiError && caught.fields) setFieldErrors(caught.fields);
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
      setChallenge(await authApi.passwordRequest(email.trim()));
      setStep('code');
    });

  const verify = (code: string): Promise<void> =>
    run(async () => {
      if (code.length !== 6) return;
      const { resetToken: token } = await authApi.passwordVerify(challenge?.email ?? email.trim(), code);
      resetToken.current = token;
      setStep('password');
    });

  const submitPassword = (): Promise<void> =>
    run(async () => {
      if (!password) {
        setFieldErrors({ password: 'Choose a new password.' });
        return;
      }
      if (password !== confirmPassword) {
        setFieldErrors({ confirmPassword: 'The passwords do not match.' });
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

  const goBack = (): void => {
    if (step === 'code') setStep('email');
    else if (step === 'password') setStep('code');
    else router.back();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.top}>
            {step !== 'done' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={goBack}
                hitSlop={12}
                style={[
                  styles.backBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Icon name="back" size={18} tone="default" />
              </Pressable>
            ) : <View style={{ width: 36 }} />}

            <View style={styles.stepBadge}>
              <Text style={{ color: colors.primary, fontSize: typography.xs, fontWeight: '700' }}>
                {step === 'email'
                  ? 'STEP 1 OF 3'
                  : step === 'code'
                    ? 'STEP 2 OF 3'
                    : step === 'password'
                      ? 'STEP 3 OF 3'
                      : 'COMPLETE'}
              </Text>
            </View>
          </View>

          {step === 'email' ? (
            <>
              <View style={styles.hero}>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: colors.text,
                    fontSize: typography.hero,
                    lineHeight: 40,
                    fontWeight: '800',
                  }}
                >
                  Reset password
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: typography.bodySm,
                    lineHeight: 22,
                    marginTop: spacing.xxs,
                  }}
                >
                  Enter the email associated with your SplitMoney account, and we will send you a verification code.
                </Text>
              </View>

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  !dark ? shadows.sm : null,
                ]}
              >
                <TextField
                  label="Email Address"
                  leftIcon="notifications"
                  value={email}
                  onChangeText={setEmail}
                  error={fieldErrors.email}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="go"
                  editable={!submitting}
                  onSubmitEditing={() => void requestCode()}
                />

                {problem ? (
                  <View
                    accessibilityLiveRegion="polite"
                    style={[
                      styles.alert,
                      {
                        backgroundColor: colors.destructiveLight,
                        borderColor: colors.destructive,
                      },
                    ]}
                  >
                    <Icon name="alert" size={18} tone="danger" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          color: colors.destructive,
                          fontSize: typography.caption,
                          fontWeight: '700',
                        }}
                      >
                        {problem.title}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: typography.xs,
                          lineHeight: 16,
                        }}
                      >
                        {problem.message}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <PrimaryButton
                  label="Send Code"
                  onPress={() => void requestCode()}
                  loading={submitting}
                  style={styles.submitButton}
                />
              </View>
            </>
          ) : step === 'code' ? (
            <>
              <View style={styles.hero}>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: colors.text,
                    fontSize: typography.hero,
                    lineHeight: 40,
                    fontWeight: '800',
                  }}
                >
                  Enter code
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: typography.bodySm,
                    lineHeight: 22,
                    marginTop: spacing.xxs,
                  }}
                >
                  We sent a 6-digit code to{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {challenge?.email ?? email}
                  </Text>
                </Text>
              </View>

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  !dark ? shadows.sm : null,
                ]}
              >
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={(code) => void verify(code)}
                  disabled={submitting}
                />

                {problem ? (
                  <View
                    accessibilityLiveRegion="polite"
                    style={[
                      styles.alert,
                      {
                        backgroundColor: colors.destructiveLight,
                        borderColor: colors.destructive,
                      },
                    ]}
                  >
                    <Icon name="alert" size={18} tone="danger" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          color: colors.destructive,
                          fontSize: typography.caption,
                          fontWeight: '700',
                        }}
                      >
                        {problem.title}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: typography.xs,
                          lineHeight: 16,
                        }}
                      >
                        {problem.message}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <PrimaryButton
                  label="Verify Code"
                  onPress={() => void verify(otp)}
                  disabled={otp.length !== 6}
                  loading={submitting}
                  style={styles.submitButton}
                />

                <View style={styles.resendBlock}>
                  {resendIn > 0 ? (
                    <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                      Resend code in {resendIn}s
                    </Text>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void requestCode()}
                      disabled={submitting}
                      hitSlop={8}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: typography.caption,
                          fontWeight: '700',
                        }}
                      >
                        Resend code
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          ) : step === 'password' ? (
            <>
              <View style={styles.hero}>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: colors.text,
                    fontSize: typography.hero,
                    lineHeight: 40,
                    fontWeight: '800',
                  }}
                >
                  New password
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: typography.bodySm,
                    lineHeight: 22,
                    marginTop: spacing.xxs,
                  }}
                >
                  Choose a secure password with at least 8 characters.
                </Text>
              </View>

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  !dark ? shadows.sm : null,
                ]}
              >
                <TextField
                  label="New Password"
                  leftIcon="security"
                  secure
                  value={password}
                  onChangeText={setPassword}
                  error={fieldErrors.password}
                  placeholder="At least 8 characters"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  editable={!submitting}
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />

                <TextField
                  ref={confirmRef}
                  label="Confirm New Password"
                  leftIcon="security"
                  secure
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  error={fieldErrors.confirmPassword}
                  placeholder="Re-enter your password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  editable={!submitting}
                  onSubmitEditing={() => void submitPassword()}
                />

                {problem ? (
                  <View
                    accessibilityLiveRegion="polite"
                    style={[
                      styles.alert,
                      {
                        backgroundColor: colors.destructiveLight,
                        borderColor: colors.destructive,
                      },
                    ]}
                  >
                    <Icon name="alert" size={18} tone="danger" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          color: colors.destructive,
                          fontSize: typography.caption,
                          fontWeight: '700',
                        }}
                      >
                        {problem.title}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: typography.xs,
                          lineHeight: 16,
                        }}
                      >
                        {problem.message}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <PrimaryButton
                  label="Set New Password"
                  onPress={() => void submitPassword()}
                  loading={submitting}
                  style={styles.submitButton}
                />
              </View>
            </>
          ) : (
            <View
              style={[
                styles.card,
                styles.doneCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                !dark ? shadows.sm : null,
              ]}
            >
              <View style={[styles.doneIcon, { backgroundColor: colors.successLight }]}>
                <Icon name="check" size={32} tone="success" />
              </View>

              <Text
                accessibilityRole="header"
                style={{
                  color: colors.text,
                  fontSize: typography.title,
                  fontWeight: '800',
                  textAlign: 'center',
                }}
              >
                Password updated
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: typography.bodySm,
                  lineHeight: 22,
                  textAlign: 'center',
                }}
              >
                Your password has been changed. For security, all other sessions have been signed out. Please sign in with your new password.
              </Text>

              <PrimaryButton
                label="Sign In"
                onPress={() => router.replace('/sign-in')}
                style={styles.doneBtn}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: spacing.base,
    gap: spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
  },
  hero: { gap: spacing.xxs },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.base,
  },
  doneCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    width: '100%',
    marginTop: spacing.sm,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  resendBlock: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
});
