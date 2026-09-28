import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { describeError } from '@/api/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { Icon } from '../Icon';
import { SMButton } from './SMButton';

export type SMErrorStateProps = {
  error: unknown;
  onRetry?: () => void;
  style?: ViewStyle;
};

export function SMErrorState({ error, onRetry, style }: SMErrorStateProps) {
  const { colors, dark } = useTheme();
  const { title, message, retryable } = describeError(error);

  return (
    <View style={[styles.container, style]} accessibilityLiveRegion="polite">
      <View
        style={[
          styles.badge,
          {
            backgroundColor: dark ? '#7F1D1D44' : '#FEE2E2',
            borderColor: dark ? '#991B1B' : '#FCA5A5',
          },
        ]}
      >
        <Icon name="alert" size={28} tone="danger" />
      </View>

      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Text>

      <Text style={[styles.message, { color: colors.muted }]}>
        {message}
      </Text>

      {retryable && onRetry ? (
        <SMButton
          label="Try Again"
          icon="refresh"
          variant="outline"
          size="md"
          onPress={onRetry}
          style={styles.retryBtn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    width: '100%',
    gap: spacing.sm,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.titleSm,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: typography.bodySm,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    fontWeight: '500',
  },
  retryBtn: {
    marginTop: spacing.md,
    minWidth: 140,
  },
});
