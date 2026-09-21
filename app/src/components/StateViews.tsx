import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { describeError } from '@/api/errors';
import { PrimaryButton } from './PrimaryButton';
import { Icon, type IconName } from './Icon';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.centred} accessibilityLiveRegion="polite">
      <View style={[styles.loadingCircle, { backgroundColor: colors.subtle }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
      <Text style={{ color: colors.muted, fontSize: typography.bodySm, fontWeight: '500' }}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const { title, message, retryable } = describeError(error);

  return (
    <View style={styles.centred} accessibilityLiveRegion="polite">
      <View
        style={[
          styles.badge,
          {
            backgroundColor: colors.destructiveLight,
            borderColor: colors.destructive,
          },
        ]}
      >
        <Icon name="alert" size={26} tone="danger" />
      </View>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '700' }}
      >
        {title}
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>{message}</Text>
      {retryable && onRetry ? (
        <PrimaryButton
          label="Try again"
          icon="refresh"
          onPress={onRetry}
          variant="primary"
          style={styles.actionBtn}
        />
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'group',
  action,
}: {
  title: string;
  message: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.centred}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: colors.subtle,
            borderColor: colors.border,
          },
        ]}
      >
        <Icon name={icon} size={28} tone="primary" />
      </View>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.text,
          fontSize: typography.titleSm,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>{message}</Text>
      {action ? (
        <PrimaryButton
          label={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'primary'}
          style={styles.actionBtn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centred: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  actionBtn: {
    marginTop: spacing.xs,
    minWidth: 140,
  },
});
