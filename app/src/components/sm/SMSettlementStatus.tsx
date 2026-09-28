import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMSettlementStatusValue =
  | 'paid_pending_approval'
  | 'will_pay_soon'
  | 'completed'
  | 'rejected'
  | 'cancelled';

type Look = { label: string; icon: IconName; tone: 'warning' | 'info' | 'success' | 'danger' | 'neutral' };

/**
 * The five states the server knows, and nothing else.
 *
 * WORDED SO THEY CANNOT BE CONFUSED. "Waiting for confirmation" and "Completed" describe
 * different financial facts: only the second one has moved a balance. "Promised" is
 * deliberately not phrased as a payment at all, because no money has changed hands.
 */
const LOOKS: Record<SMSettlementStatusValue, Look> = {
  paid_pending_approval: { label: 'Waiting for confirmation', icon: 'clock', tone: 'warning' },
  will_pay_soon: { label: 'Promised — not paid yet', icon: 'calendar', tone: 'info' },
  completed: { label: 'Completed', icon: 'checkCircle', tone: 'success' },
  rejected: { label: 'Rejected', icon: 'alertCircle', tone: 'danger' },
  cancelled: { label: 'Cancelled', icon: 'close', tone: 'neutral' },
};

export const settlementStatusLabel = (status: string): string =>
  LOOKS[status as SMSettlementStatusValue]?.label ?? status;

export type SMSettlementStatusProps = {
  status: string;
  size?: 'sm' | 'md';
};

/**
 * A settlement's state, as an icon, a word and a tint — never the tint alone.
 *
 * Every state carries its own icon and its own wording, so it reads correctly for someone
 * who cannot tell the tints apart, in greyscale, or through a screen reader.
 */
export function SMSettlementStatus({ status, size = 'sm' }: SMSettlementStatusProps) {
  const { colors, dark } = useTheme();
  const look = LOOKS[status as SMSettlementStatusValue] ?? {
    label: status,
    icon: 'info' as IconName,
    tone: 'neutral' as const,
  };

  const tint = {
    warning: { bg: colors.warningLight, fg: colors.warning },
    info: { bg: colors.infoLight, fg: colors.info },
    success: { bg: colors.successLight, fg: colors.success },
    danger: { bg: colors.destructiveLight, fg: colors.destructive },
    neutral: { bg: dark ? colors.surfaceElevated : colors.subtle, fg: colors.muted },
  }[look.tone];

  const large = size === 'md';

  return (
    <View
      accessible
      accessibilityLabel={'Status: ' + look.label}
      style={[styles.pill, large ? styles.pillLarge : null, { backgroundColor: tint.bg }]}
    >
      <Icon name={look.icon} size={large ? 14 : 12} color={tint.fg} />
      <Text style={[styles.label, large ? styles.labelLarge : null, { color: tint.fg }]}>
        {look.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pillLarge: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  label: { fontSize: typography.xs, fontWeight: '700' },
  labelLarge: { fontSize: typography.caption },
});
