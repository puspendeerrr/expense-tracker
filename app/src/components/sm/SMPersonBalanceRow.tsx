import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { SMAvatar } from './SMAvatar';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';

export type SMPersonBalanceRowProps = {
  name: string;
  avatarUrl?: string | null;
  /** Already formatted by the caller. This component never touches money maths. */
  amount: string;
  /** Which way this one pair points. Never a netted figure. */
  direction: 'i_owe' | 'they_owe' | 'settled';
  onPress?: () => void;
};

/**
 * One person and what stands between the two of you.
 *
 * DIRECTIONAL, AND SAYS SO IN WORDS. The amount is tinted, but the row also states "You
 * owe them" or "Owes you" in text, because colour alone is not an accessible way to carry
 * the single most important fact on the screen — and red/green is exactly the pair that
 * the most common form of colour blindness collapses.
 *
 * This is one side of one pair. The server keeps balances pairwise and directional, and
 * this row is deliberately incapable of summing two of itself into a net figure.
 */
export function SMPersonBalanceRow({
  name,
  avatarUrl,
  amount,
  direction,
  onPress,
}: SMPersonBalanceRowProps) {
  const { colors, dark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const owing = direction === 'i_owe';
  const settled = direction === 'settled';

  const amountColor = settled ? colors.muted : owing ? colors.destructive : colors.success;
  const relation = settled ? 'All square' : owing ? 'You owe them' : 'Owes you';

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
        accessibilityLabel={name + ', ' + relation + ', ' + amount}
        accessibilityHint={onPress ? 'Opens the breakdown behind this figure' : undefined}
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
        <SMAvatar name={name} uri={avatarUrl} size={42} round />

        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={[styles.relation, { color: colors.muted }]}>
            {relation}
          </Text>
        </View>

        <View style={styles.right}>
          <Text numberOfLines={1} style={[styles.amount, { color: amountColor }]}>
            {amount}
          </Text>
          {onPress ? <Icon name="forward" size={14} tone="muted" /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 68,
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: typography.bodySm, fontWeight: '700', letterSpacing: -0.1 },
  relation: { fontSize: typography.caption },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '42%' },
  amount: { fontSize: typography.body, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
});
