import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';

export type SMSettlementTone = 'positive' | 'negative' | 'neutral';

export type SMChip = {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
};

export type SMSettlementListItemProps = {
  /** "You paid Satyawan" / "Aman Batar paid you" — composed by the caller. */
  title: string;
  /** Already formatted. This component never touches money maths. */
  amount: string;
  dateLabel: string;
  /** Which way the money went, for the amount's tint. */
  tone?: SMSettlementTone;
  /** Status, method, proof — at most three, or the row stops being a row. */
  chips?: SMChip[];
  onPress?: () => void;
};

/**
 * One settlement, as a row.
 *
 * Deliberately built to the same skeleton as [SMExpenseListItem]: icon well, body, then a
 * right-aligned amount. A settlement and an expense are different events, but in a list
 * they are both "something happened, for this much money", and giving them two different
 * shapes makes Overview read as two unrelated screens stacked on top of each other.
 *
 * The legacy card stacked a 42dp avatar, a title, a date and THREE badges on separate
 * lines, so three settlements filled a phone screen. Here the badges are one quiet inline
 * strip under the title, because "Completed / Cash" is reassurance you check once, not the
 * reason you looked.
 */
export function SMSettlementListItem({
  title,
  amount,
  dateLabel,
  tone = 'neutral',
  chips = [],
  onPress,
}: SMSettlementListItemProps) {
  const { colors, dark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const amountColor =
    tone === 'positive' ? colors.success : tone === 'negative' ? colors.destructive : colors.text;

  const chipColors = (chipTone: SMChip['tone']) => {
    switch (chipTone) {
      case 'success':
        return { bg: colors.successLight, fg: colors.success };
      case 'warning':
        return { bg: colors.warningLight, fg: colors.warning };
      case 'danger':
        return { bg: colors.destructiveLight, fg: colors.destructive };
      case 'info':
        return { bg: colors.infoLight, fg: colors.info };
      default:
        return { bg: dark ? colors.surfaceElevated : colors.subtle, fg: colors.muted };
    }
  };

  const press = (to: number): void => {
    if (!onPress) return;
    Animated.timing(scale, {
      toValue: to,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={
          title + ', ' + amount + ', ' + dateLabel +
          (chips.length ? '. ' + chips.map((chip) => chip.label).join(', ') : '')
        }
        onPress={onPress}
        onPressIn={() => press(motion.scale.pressed)}
        onPressOut={() => press(1)}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.surface,
            borderColor: dark ? colors.borderStrong : colors.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: colors.primarySubtle ?? colors.subtle,
              borderColor: dark ? colors.borderStrong : 'transparent',
            },
          ]}
        >
          <Icon name="settlement" size={17} tone="primary" />
        </View>

        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>
            {dateLabel}
          </Text>

          {chips.length ? (
            <View style={styles.chips}>
              {chips.slice(0, 3).map((chip) => {
                const tint = chipColors(chip.tone);
                return (
                  <View
                    key={chip.label}
                    style={[styles.chip, { backgroundColor: tint.bg }]}
                  >
                    <Text style={[styles.chipLabel, { color: tint.fg }]}>{chip.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <Text numberOfLines={1} style={[styles.amount, { color: amountColor }]}>
          {amount}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 68,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: typography.bodySm, fontWeight: '700', letterSpacing: -0.1 },
  meta: { fontSize: typography.caption },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  chipLabel: { fontSize: typography.xs, fontWeight: '700' },
  // Sits on the title's baseline rather than centring against the chip strip.
  amount: { fontSize: typography.body, fontWeight: '800', letterSpacing: -0.3, maxWidth: '32%' },
});
