import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon } from '../Icon';

export type SMLogoSize = 'sm' | 'md' | 'lg';

type Props = {
  size?: SMLogoSize;
  showTagline?: boolean;
  align?: 'left' | 'center';
};

export function SMLogo({ size = 'md', showTagline = false, align = 'center' }: Props) {
  const { colors, dark } = useTheme();

  const dimensions = {
    sm: { mark: 34, icon: 18, title: typography.titleSm, letterSpacing: -0.2 },
    md: { mark: 44, icon: 22, title: typography.title, letterSpacing: -0.3 },
    lg: { mark: 56, icon: 28, title: typography.heroSm, letterSpacing: -0.5 },
  }[size];

  return (
    <View style={[styles.wrap, align === 'center' ? styles.center : styles.left]}>
      <View style={styles.brandRow}>
        <View
          style={[
            styles.mark,
            {
              width: dimensions.mark,
              height: dimensions.mark,
              backgroundColor: colors.primary,
              borderColor: dark ? colors.borderStrong : 'rgba(255,255,255,0.2)',
            },
            !dark ? shadows.sm : null,
          ]}
        >
          <Icon name="money" size={dimensions.icon} color={colors.onPrimary} />
        </View>

        <View style={styles.titleCol}>
          <Text
            accessibilityRole="header"
            style={[
              styles.brandText,
              {
                color: colors.text,
                fontSize: dimensions.title,
                letterSpacing: dimensions.letterSpacing,
              },
            ]}
          >
            Split<Text style={{ color: colors.primary }}>Money</Text>
          </Text>
        </View>
      </View>

      {showTagline ? (
        <Text style={[styles.tagline, { color: colors.muted }]}>
          Simple money sharing for groups
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  center: {
    alignItems: 'center',
  },
  left: {
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  mark: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    justifyContent: 'center',
  },
  brandText: {
    fontWeight: '800',
  },
  tagline: {
    fontSize: typography.caption,
    fontWeight: '500',
    marginTop: spacing.xxs,
  },
});

