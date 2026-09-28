import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { SMSheet } from './SMSheet';
import { SMSelectField } from './SMSelectField';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMDateFieldProps = {
  label: string;
  /** `YYYY-MM-DD`, the exact format the server requires. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** A local calendar date as `YYYY-MM-DD` — the same construction as `todayIso`. */
const toIso = (year: number, month: number, day: number): string =>
  year + '-' + pad(month + 1) + '-' + pad(day);

const parseIso = (iso: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The expense date, chosen from a calendar rather than typed.
 *
 * Replaces a free-text "YYYY-MM-DD" field. Typing a date on a phone keyboard in ISO order
 * is slow and easy to get wrong, and a malformed date was only discovered when the server
 * refused it. A calendar can only ever produce a well-formed date in exactly the format the
 * server's schema demands.
 *
 * FUTURE DAYS ARE NOT OFFERED. The server refuses an expense dated in the future, so those
 * days are drawn but disabled — visible, so the calendar still reads as a calendar, but not
 * choosable. The comparison uses the phone's local calendar day, matching `todayIso`, which
 * is also what the field defaults to.
 *
 * Built from plain views rather than a native date picker, which is not installed and
 * would need a native rebuild to add.
 */
export function SMDateField({ label, value, onChange, error, disabled }: SMDateFieldProps) {
  const { colors, dark } = useTheme();
  const [open, setOpen] = useState(false);

  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, []);
  const todayIso = toIso(today.year, today.month, today.day);
  const yesterdayIso = useMemo(() => {
    const d = new Date(today.year, today.month, today.day - 1);
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }, [today]);

  const selected = parseIso(value);
  const [view, setView] = useState({
    year: selected?.year ?? today.year,
    month: selected?.month ?? today.month,
  });

  // Reopening lands on the month of the chosen date, not wherever it was last left.
  // Keyed on `open` alone on purpose: the view must not jump while the sheet is showing.
  useEffect(() => {
    if (open && selected) setView({ year: selected.year, month: selected.month });
  }, [open]);

  const readable = (iso: string): string => {
    if (iso === todayIso) return 'Today';
    if (iso === yesterdayIso) return 'Yesterday';
    const parts = parseIso(iso);
    if (!parts) return iso;
    return new Date(parts.year, parts.month, parts.day).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const atCurrentMonth = view.year === today.year && view.month === today.month;

  // The grid: leading blanks for the weekday the month starts on, then each day.
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1).getDay();
    const count = new Date(view.year, view.month + 1, 0).getDate();
    const list: (number | null)[] = Array.from({ length: first }, () => null);
    for (let day = 1; day <= count; day += 1) list.push(day);
    return list;
  }, [view]);

  const isFuture = (day: number): boolean =>
    view.year > today.year ||
    (view.year === today.year && view.month > today.month) ||
    (view.year === today.year && view.month === today.month && day > today.day);

  const shift = (delta: number): void => {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  const choose = (iso: string): void => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      <SMSelectField
        label={label}
        value={readable(value)}
        icon="calendar"
        onPress={() => setOpen(true)}
        {...(error ? { error } : {})}
        {...(disabled ? { disabled } : {})}
      />

      <SMSheet visible={open} onClose={() => setOpen(false)} title="When was it?">
        <View style={styles.quick}>
          {[
            { iso: todayIso, text: 'Today' },
            { iso: yesterdayIso, text: 'Yesterday' },
          ].map((option) => {
            const on = value === option.iso;
            return (
              <Pressable
                key={option.iso}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => choose(option.iso)}
                style={({ pressed }) => [
                  styles.quickChip,
                  {
                    backgroundColor: on ? colors.primary : dark ? colors.surface : colors.subtle,
                    borderColor: on ? colors.primary : dark ? colors.borderStrong : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.quickText,
                    { color: on ? colors.onPrimary ?? '#FFFFFF' : colors.text },
                  ]}
                >
                  {option.text}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => shift(-1)}
            hitSlop={10}
            style={({ pressed }) => [styles.monthNav, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Icon name="back" size={18} tone="default" />
          </Pressable>

          <Text accessibilityRole="header" style={[styles.monthLabel, { color: colors.text }]}>
            {monthLabel}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: atCurrentMonth }}
            disabled={atCurrentMonth}
            onPress={() => shift(1)}
            hitSlop={10}
            style={({ pressed }) => [
              styles.monthNav,
              { opacity: atCurrentMonth ? 0.25 : pressed ? 0.5 : 1 },
            ]}
          >
            <Icon name="forward" size={18} tone="default" />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {WEEKDAYS.map((weekday, index) => (
            <Text key={'w' + index} style={[styles.weekday, { color: colors.muted }]}>
              {weekday}
            </Text>
          ))}

          {cells.map((day, index) => {
            if (day === null) return <View key={'b' + index} style={styles.cell} />;

            const iso = toIso(view.year, view.month, day);
            const on = iso === value;
            const isToday = iso === todayIso;
            const future = isFuture(day);

            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityLabel={readable(iso) + (future ? ', unavailable' : '')}
                accessibilityState={{ selected: on, disabled: future }}
                disabled={future}
                onPress={() => choose(iso)}
                style={styles.cell}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.day,
                      {
                        backgroundColor: on
                          ? colors.primary
                          : pressed
                            ? colors.primarySubtle ?? colors.subtle
                            : 'transparent',
                        borderColor: isToday && !on ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        {
                          color: on
                            ? colors.onPrimary ?? '#FFFFFF'
                            : future
                              ? colors.muted
                              : colors.text,
                          opacity: future ? 0.35 : 1,
                          fontWeight: on || isToday ? '800' : '500',
                        },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </SMSheet>
    </>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.base },
  quickChip: {
    paddingHorizontal: spacing.base,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  quickText: { fontSize: typography.bodySm, fontWeight: '700' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  monthNav: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: typography.body, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: spacing.base },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: typography.xs,
    fontWeight: '700',
    paddingBottom: spacing.sm,
  },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: typography.bodySm },
});
