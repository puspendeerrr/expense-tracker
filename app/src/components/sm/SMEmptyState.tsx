import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { Icon, type IconName } from '../Icon';
import { SMButton } from './SMButton';

export type SMEmptyStateProps = {
  icon?: IconName;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    icon?: IconName;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    icon?: IconName;
    onPress: () => void;
  };
  style?: ViewStyle;
};

export function SMEmptyState({
  icon = 'group',
  title,
  description,
  primaryAction,
  secondaryAction,
  style,
}: SMEmptyStateProps) {
  const { colors, dark } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {/* Icon Pill */}
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: dark ? '#064E3B33' : '#ECFDF5',
            borderColor: dark ? '#065F46' : '#A7F3D0',
          },
        ]}
      >
        <Icon name={icon} size={30} tone="primary" />
      </View>

      {/* Typography */}
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Text>

      <Text style={[styles.description, { color: colors.muted }]}>
        {description}
      </Text>

      {/* Action Buttons */}
      {primaryAction || secondaryAction ? (
        <View style={styles.actionGroup}>
          {primaryAction ? (
            <SMButton
              label={primaryAction.label}
              icon={primaryAction.icon}
              variant="primary"
              size="md"
              onPress={primaryAction.onPress}
              style={styles.btn}
            />
          ) : null}

          {secondaryAction ? (
            <SMButton
              label={secondaryAction.label}
              icon={secondaryAction.icon}
              variant="outline"
              size="md"
              onPress={secondaryAction.onPress}
              style={styles.btn}
            />
          ) : null}
        </View>
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
  iconCircle: {
    width: 64,
    height: 64,
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
    letterSpacing: -0.3,
  },
  description: {
    fontSize: typography.bodySm,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    fontWeight: '500',
  },
  actionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    minWidth: 140,
  },
});
