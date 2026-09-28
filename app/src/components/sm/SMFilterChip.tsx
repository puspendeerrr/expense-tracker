import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMFilterChipProps = {
  label: string;
  icon?: IconName;
  /** Present when the chip can be dismissed on its own. */
  onRemove?: () => void;
  /** Tapping the chip body, usually to reopen the control that set it. */
  onPress?: () => void;
};

/**
 * One active filter, shown so it can be undone without opening anything.
 *
 * THE POINT IS REVERSIBILITY. A filter you cannot see is a filter you forget you set, and
 * an empty ledger then looks like missing data rather than a narrow question. Each chip
 * names one constraint and carries its own dismiss, so backing out of a single choice does
 * not mean reopening the sheet and hunting for which control did it.
 *
 * Tinted with the brand colour rather than a warning colour: an active filter is a normal
 * state the reader chose, not a problem to be alarmed about.
 *
 * The dismiss is a nested pressable with its own generous hit area, and the chip body
 * carries a separate label, so a screen reader offers "remove" and "edit" as two distinct
 * actions rather than one ambiguous target.
 */
export function SMFilterChip({ label, icon, onRemove, onPress }: SMFilterChipProps) {
  const { colors } = useTheme();

  const body = (
    <>
      {icon ? <Icon name={icon} size={12} color={colors.primary} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color: colors.primary }]}>
        {label}
      </Text>
    </>
  );

  return (
    <View style={[styles.chip, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label + '. Change this filter.'}
          onPress={onPress}
          style={({ pressed }) => [styles.body, { opacity: pressed ? 0.6 : 1 }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.body}>{body}</View>
      )}

      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'Remove filter ' + label}
          onPress={onRemove}
          hitSlop={10}
          style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Icon name="close" size={12} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.xs,
    minHeight: 30,
    maxWidth: 220,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  label: { fontSize: typography.xs, fontWeight: '700', letterSpacing: -0.1, flexShrink: 1 },
  remove: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
});
