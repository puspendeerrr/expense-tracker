import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMDetailRowProps = {
  label: string;
  value: ReactNode;
  /** Overrides the value's colour, for a figure that carries meaning. */
  tone?: string;
};

/**
 * One label-and-value line in a details panel.
 *
 * WRAPS RATHER THAN TRUNCATES. The legacy row kept both sides on one line, so a long note
 * or a full timestamp was clipped with no way to read the rest. Here the value is allowed
 * to take the width it needs and fall below the label when the two cannot share a line,
 * which matters most for exactly the fields people open this panel to read.
 *
 * The label stays at a fixed proportion so a column of rows aligns down the screen instead
 * of each line starting wherever its own label ended.
 */
export function SMDetailRow({ label, value, tone }: SMDetailRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>

      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.value, { color: tone ?? colors.text }]}>{value}</Text>
      ) : (
        <View style={styles.slot}>{value}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    flexWrap: 'wrap',
  },
  // The label keeps its own width; the value takes the rest and wraps inside it.
  label: { fontSize: typography.caption, fontWeight: '500', flexShrink: 0, maxWidth: '45%' },
  value: {
    fontSize: typography.bodySm,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  slot: { flex: 1, alignItems: 'flex-end' },
});
