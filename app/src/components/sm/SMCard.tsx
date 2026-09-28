import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing } from '@/theme/tokens';

export type SMCardProps = ViewProps & {
  elevated?: boolean;
};

export function SMCard({ style, elevated = false, children, ...props }: SMCardProps) {
  const { colors, dark } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated
            ? dark
              ? colors.surfaceElevated
              : colors.surface
            : colors.surface,
          borderColor: dark ? colors.borderStrong : colors.border,
        },
        !dark ? (elevated ? shadows.md : shadows.sm) : null,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.base,
    width: '100%',
  },
});

