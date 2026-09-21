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
import { useAuth } from '@/auth/AuthProvider';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { OtpInput } from '@/components/OtpInput';
import { Icon } from '@/components/Icon';
import { useCountdown } from '@/hooks/useCountdown';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

export default function SignUpScreen() {
  const { colors, dark } = useTheme();
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
      if (caught instanceof ApiError && caught.fields) setFieldErrors(caught.fields);
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
      setChallenge(await authApi.signUpResend(challenge?.email ?? email.trim()));
      setOtp('');
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
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
          {/* Header navigation */}
          <View style={styles.top}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => (step === 'code' ? setStep('details') : router.back())}
              hitSlop={12}
              style={[
                styles.backBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Icon name="back" size={18} tone="default" />
            </Pressable>

            <View style={styles.stepBadge}>
              <Text style={{ color: colors.primary, fontSize: typography.xs, fontWeight: '700' }}>
                {step === 'details' ? 'STEP 1 OF 2' : 'STEP 2 OF 2'}
              </Text>
            </View>
          </View>

          {step === 'details' ? (
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
                  Create account
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: typography.bodySm,
                    lineHeight: 22,
                    marginTop: spacing.xxs,
                  }}
                >
                  Join SplitMoney to easily split bills, track balances, and settle debts with friends.
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
                  label="Full Name"
                  leftIcon="person"
                  value={fullName}
                  onChangeText={setFullName}
                  error={fieldErrors.fullName}
                  placeholder="Rahul Sharma"
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                  editable={!submitting}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />

                <TextField
                  ref={emailRef}
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
                  returnKeyType="next"
                  editable={!submitting}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />

                <TextField
                  ref={passwordRef}
                  label="Password"
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
                  label="Confirm Password"
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
                  label="Continue"
                  onPress={() => void requestCode()}
                  loading={submitting}
                  style={styles.submitButton}
                />
              </View>

              <View style={styles.footer}>
                <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                  Already have an account?
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/sign-in')}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: typography.caption,
                      fontWeight: '700',
                    }}
                  >
                    Sign In
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
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
                  Verify your email
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: typography.bodySm,
                    lineHeight: 22,
                    marginTop: spacing.xxs,
                  }}
                >
                  We emailed a 6-digit verification code to{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {challenge?.email ?? email}
                  </Text>
                  . Enter it below to complete registration.
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
                  label="Verify & Sign In"
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
                      onPress={() => void resend()}
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
  },
});
