import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMBadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export type SMBadgeProps = {
  label: string;
  tone?: SMBadgeTone;
  icon?: IconName;
};

/**
 * A small status pill.
 *
 * Replaces the legacy badge, which drew a 1px border on every tone. Six bordered pills in
 * a row turn into a fence; here the tint alone carries the tone, so a run of them stays
 * quiet enough to sit under a title without competing with it.
 *
 * `primary` is the app's green and is reserved for what is true about *you* — "You",
 * "Owner". Status that the server decides uses success/warning/danger, so the two never
 * get confused at a glance.
 */
export function SMBadge({ label, tone = 'neutral', icon }: SMBadgeProps) {
  const { colors, dark } = useTheme();

  const palette: Record<SMBadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: dark ? colors.surfaceElevated : colors.subtle, fg: colors.muted },
    primary: { bg: colors.primarySubtle ?? colors.subtle, fg: colors.primary },
    success: { bg: colors.successLight, fg: colors.success },
    warning: { bg: colors.warningLight, fg: colors.warning },
    danger: { bg: colors.destructiveLight, fg: colors.destructive },
    info: { bg: colors.infoLight, fg: colors.info },
  };

  const tint = palette[tone];

  return (
    <View style={[styles.badge, { backgroundColor: tint.bg }]}>
      {icon ? <Icon name={icon} size={11} color={tint.fg} /> : null}
      <Text style={[styles.label, { color: tint.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: { fontSize: typography.xs, fontWeight: '700', letterSpacing: -0.1 },
});
