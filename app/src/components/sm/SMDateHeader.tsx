import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMDateHeaderProps = {
  /** "Today", "Yesterday", or a real date. Decided by the caller, not here. */
  label: string;
  /** The day's total, already formatted. Omitted when a running total would mislead. */
  total?: string;
};

/**
 * The divider between one day's expenses and the next.
 *
 * DELIBERATELY SECONDARY. A ledger is read by scanning amounts, and date headings are
 * signposts you use only once you have found something worth placing in time. Setting them
 * at caption size in the muted colour keeps them legible without letting eight of them
 * compete with the rows they separate — the mistake of making every heading large is what
 * turns a ledger into a list of little tables.
 *
 * The hairline runs to the end of the row so the eye reads it as a boundary rather than as
 * another piece of content, and the optional day total sits at the end where a running
 * figure is conventionally found.
 */
export function SMDateHeader({ label, total }: SMDateHeaderProps) {
  const { colors, dark } = useTheme();

  return (
    <View style={styles.row} accessibilityRole="header">
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: dark ? colors.borderStrong : colors.border }]} />
      {total ? <Text style={[styles.total, { color: colors.muted }]}>{total}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  label: { fontSize: typography.caption, fontWeight: '700', letterSpacing: -0.1 },
  rule: { flex: 1, height: 1 },
  total: { fontSize: typography.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
