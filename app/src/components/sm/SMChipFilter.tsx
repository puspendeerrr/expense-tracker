import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMChipFilterOption<T extends string> = { value: T; label: string };

export type SMChipFilterProps<T extends string> = {
  options: SMChipFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/**
 * A single-choice filter as a scrolling row of pills.
 *
 * For a short, fixed set of values that people switch between often — settlement status,
 * say — a row of pills is one tap where a sheet is three. It is deliberately NOT drawn like
 * the section tabs above it (no underline, no sliding bar): those move you somewhere, this
 * narrows what you are already looking at, and the two should not be mistaken for each
 * other when they sit on the same screen.
 */
export function SMChipFilter<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SMChipFilterProps<T>) {
  const { colors, dark } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? colors.primary : dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
                borderColor: on ? colors.primary : dark ? colors.borderStrong : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.label, { color: on ? colors.onPrimary ?? '#FFFFFF' : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontSize: typography.caption, fontWeight: '700' },
});
