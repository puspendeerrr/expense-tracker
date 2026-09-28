import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SMSheet } from './SMSheet';
import { SMButton } from './SMButton';
import { SMOptionRow } from './SMOptionRow';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

/** One choice within a group. `value` of undefined means "no constraint". */
export type SMFilterOption = {
  value: string | undefined;
  label: string;
};

export type SMFilterGroup = {
  /** Matches a key on the draft object the sheet edits. */
  key: string;
  title: string;
  options: SMFilterOption[];
};

export type SMExpenseFilterSheetProps<T extends Record<string, string | undefined>> = {
  visible: boolean;
  onClose: () => void;
  groups: SMFilterGroup[];
  /** The filters currently in effect. The sheet never mutates this. */
  value: T;
  onApply: (next: T) => void;
  onReset: () => void;
  /** How many rows the current draft would show, when the caller can say cheaply. */
  resultHint?: string;
};

/**
 * The expense ledger's filters, as one sheet.
 *
 * REPLACES FOUR SEPARATE SHEETS. The previous design opened a different sheet per facet,
 * so setting category and payer meant two round trips through a modal and there was never
 * a moment where the whole question was visible at once. Filters are read together — "food,
 * paid by Rahul" is one thought — so they are now edited together.
 *
 * EDITS A DRAFT, NOT THE LIVE FILTERS. Every tap in the old sheet refetched immediately,
 * which meant a person assembling a three-part filter fired three queries and watched the
 * list thrash underneath the sheet. Here changes accumulate locally and commit on Apply, so
 * the ledger is re-queried once. Closing without applying leaves the ledger exactly as it
 * was, which is what dismissing a sheet should mean.
 *
 * The draft resyncs from `value` each time the sheet opens, so reopening after a dismissal
 * shows what is actually in effect rather than an abandoned edit.
 */
export function SMExpenseFilterSheet<T extends Record<string, string | undefined>>({
  visible,
  onClose,
  groups,
  value,
  onApply,
  onReset,
  resultHint,
}: SMExpenseFilterSheetProps<T>) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<T>(value);

  // Reopening shows what is in effect, never a half-finished edit from last time.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const activeCount = groups.filter((group) => draft[group.key] !== undefined).length;

  return (
    <SMSheet
      visible={visible}
      onClose={onClose}
      title="Filter expenses"
      subtitle={
        activeCount === 0
          ? 'Showing every expense in this group'
          : activeCount === 1
            ? '1 filter selected'
            : activeCount + ' filters selected'
      }
      footer={
        <View style={styles.footer}>
          <SMButton
            label="Reset"
            variant="secondary"
            onPress={() => {
              onReset();
              onClose();
            }}
            style={styles.footerButton}
            accessibilityHint="Clears every filter and shows all expenses"
          />
          <SMButton
            label="Apply filters"
            variant="primary"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={styles.footerButtonWide}
          />
        </View>
      }
    >
      {resultHint ? (
        <Text style={[styles.hint, { color: colors.muted }]}>{resultHint}</Text>
      ) : null}

      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.muted }]}>{group.title}</Text>

          {group.options.map((option) => (
            <SMOptionRow
              key={group.key + ':' + (option.value ?? 'any')}
              label={option.label}
              selected={(draft[group.key] ?? undefined) === option.value}
              onPress={() => setDraft((current) => ({ ...current, [group.key]: option.value }))}
            />
          ))}
        </View>
      ))}
    </SMSheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: typography.caption, paddingBottom: spacing.sm },
  group: { paddingBottom: spacing.base, gap: 2 },
  groupTitle: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  footer: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { flex: 1 },
  // Apply is the wider of the two: it is what the sheet is for.
  footerButtonWide: { flex: 1.6 },
});
