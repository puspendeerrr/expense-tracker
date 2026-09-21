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
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { ThemeToggle } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/auth/AuthProvider';
import { ApiError, describeError } from '@/api/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

export default function SignInScreen() {
  const { colors, dark } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const passwordRef = useRef<TextInput>(null);

  const submit = async (): Promise<void> => {
    if (submitting) return;

    const trimmed = email.trim();
    if (!trimmed || !password) {
      setFieldErrors({
        ...(trimmed ? {} : { email: 'Enter your email address.' }),
        ...(password ? {} : { password: 'Enter your password.' }),
      });
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});

    try {
      await signIn(trimmed, password);
    } catch (caught: unknown) {
      setError(caught);
      if (caught instanceof ApiError && caught.fields) setFieldErrors(caught.fields);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const problem = error ? describeError(error) : undefined;

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
          {/* Top navigation & theme toggle */}
          <View style={styles.top}>
            <View style={styles.brand}>
              <View
                style={[
                  styles.mark,
                  { backgroundColor: colors.primary },
                  !dark ? shadows.sm : null,
                ]}
              >
                <Text
                  style={{
                    fontSize: typography.titleSm,
                    fontWeight: '800',
                    color: colors.onPrimary,
                  }}
                >
                  S
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
                SplitMoney
              </Text>
            </View>
            <ThemeToggle />
          </View>

          {/* Hero text */}
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
              Welcome back
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: typography.bodySm,
                lineHeight: 22,
                marginTop: spacing.xxs,
              }}
            >
              Sign in to manage your groups, track expenses, and settle balances effortlessly.
            </Text>
          </View>

          {/* Form card */}
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
              leftIcon="person"
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
              placeholder="Enter your password"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              editable={!submitting}
              onSubmitEditing={() => void submit()}
            />

            <View style={styles.forgotRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/forgot-password')}
                hitSlop={8}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: typography.caption,
                    fontWeight: '700',
                  }}
                >
                  Forgot password?
                </Text>
              </Pressable>
            </View>

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
              label="Sign In"
              onPress={() => void submit()}
              loading={submitting}
              style={styles.submitButton}
            />
          </View>

          {/* Footer alternatives */}
          <View style={styles.footer}>
            <Text style={{ color: colors.muted, fontSize: typography.caption }}>
              Don&apos;t have an account?
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/sign-up')}
              hitSlop={8}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: typography.caption,
                  fontWeight: '700',
                }}
              >
                Create an account
              </Text>
            </Pressable>
          </View>
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { gap: spacing.xxs },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.base,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
  },
});
