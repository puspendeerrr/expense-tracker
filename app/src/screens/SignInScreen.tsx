import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ApiError, describeError } from '@/api/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { ThemeToggle } from '@/components/AppHeader';
import {
  SMLogo,
  SMButton,
  SMTextInput,
  SMPasswordInput,
  SMCard,
  SMInlineNotice,
  SMAuthContainer,
  SMAuthFooter,
} from '@/components/sm';

export default function SignInScreen() {
  const { colors } = useTheme();
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
    const problems: Record<string, string> = {};
    if (!trimmed) problems.email = 'Enter your email address.';
    if (!password) problems.password = 'Enter your password.';

    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});

    try {
      await signIn(trimmed, password);
    } catch (caught: unknown) {
      setError(caught);
      if (caught instanceof ApiError && caught.fields) {
        setFieldErrors(caught.fields);
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const problem = error ? describeError(error) : undefined;

  return (
    <SMAuthContainer>
      {/* Top row: Brand & Theme toggle */}
      <View style={styles.topRow}>
        <SMLogo size="sm" align="left" />
        <ThemeToggle />
      </View>

      {/* Hero introduction */}
      <View style={styles.heroBlock}>
        <Text
          accessibilityRole="header"
          style={[styles.headline, { color: colors.text }]}
        >
          Welcome back
        </Text>
        <Text style={[styles.subheadline, { color: colors.muted }]}>
          Sign in to manage your groups, track expenses, and settle balances effortlessly.
        </Text>
      </View>

      {/* Interactive Form Card */}
      <SMCard elevated>
        <SMTextInput
          label="Email Address"
          leftIcon="mail"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
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

        <View style={styles.passwordFieldWrap}>
          <SMPasswordInput
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
            }}
            error={fieldErrors.password}
            placeholder="Enter your password"
            autoComplete="current-password"
            returnKeyType="go"
            blurOnSubmit={true}
            editable={!submitting}
            onSubmitEditing={() => void submit()}
          />

          <View style={styles.forgotRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Forgot your password? Recover your account"
              onPress={() => router.push('/forgot-password')}
              hitSlop={12}
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                Forgot password?
              </Text>
            </Pressable>
          </View>
        </View>

        {problem ? (
          <SMInlineNotice
            type="error"
            title={problem.title}
            message={problem.message}
          />
        ) : null}

        <SMButton
          label="Sign In"
          loadingLabel="Signing in…"
          variant="primary"
          size="lg"
          loading={submitting}
          onPress={() => void submit()}
          style={styles.submitBtn}
        />
      </SMCard>

      {/* Footer Navigation */}
      <SMAuthFooter
        promptText="Don't have an account?"
        actionText="Create an account"
        onPress={() => router.push('/sign-up')}
      />
    </SMAuthContainer>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.xs,
  },
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
  passwordFieldWrap: {
    gap: spacing.xs,
    width: '100%',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  forgotText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
