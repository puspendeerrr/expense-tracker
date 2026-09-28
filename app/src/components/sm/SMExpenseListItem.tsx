import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { SMAmount } from './SMAmount';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';

export type SMExpenseListItemProps = {
  title: string;
  /** Already formatted by the caller. This component never touches money maths. */
  amount: string;
  payerLabel: string;
  /** Omitted where the list already groups by date and repeating it would be noise. */
  dateLabel?: string;
  /** "Your share ₹120" or "You lent ₹400" — the caller decides which, and its tone. */
  shareLabel?: string;
  shareTone?: 'owed' | 'owing' | 'neutral';
  categoryIcon?: IconName;
  hasReceipt?: boolean;
  onPress?: () => void;
  /** A shortcut to this row's actions. Offered only where the viewer may use them. */
  onLongPress?: () => void;
};

/**
 * One expense, as a row.
 *
 * Replaces the legacy expense card. That card gave the title, the amount, the payer, the
 * date and four badges roughly equal weight, so scanning a list meant reading every row
 * in full.
 *
 * THE HIERARCHY IS: amount, title, everything else. The amount is the largest thing on the
 * row and right-aligned, so a column of them can be scanned vertically without reading any
 * words. The title is next. The payer and date are one quiet line — they answer "whose was
 * this?" only once a row has already caught the eye.
 *
 * The share line is the row's second job: what the expense did to *you*. It is tinted —
 * green when you are owed, red when you owe — and it is the only colour in the row, so it
 * carries meaning rather than decoration.
 */
export function SMExpenseListItem({
  title,
  amount,
  payerLabel,
  dateLabel,
  shareLabel,
  shareTone = 'neutral',
  categoryIcon = 'expense',
  hasReceipt = false,
  onPress,
  onLongPress,
}: SMExpenseListItemProps) {
  const { colors, dark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const shareColor =
    shareTone === 'owed' ? colors.success : shareTone === 'owing' ? colors.destructive : colors.muted;

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
        // One sentence, in the order a person would say it.
        accessibilityLabel={
          title + ', ' + amount + ', ' + payerLabel + (dateLabel ? ', ' + dateLabel : '') +
          (shareLabel ? '. ' + shareLabel : '')
        }
        /*
         * A long press is invisible to a screen reader, so the same shortcut is published
         * as a named action. Without this, the row's extra capability would exist only for
         * people who can press and hold precisely.
         */
        accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'Expense actions' }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') onLongPress?.();
        }}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        onPressIn={() => press(motion.scale.pressed)}
        onPressOut={() => press(1)}
        disabled={!onPress && !onLongPress}
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
          <Icon name={categoryIcon} size={17} tone="primary" />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
              {title}
            </Text>
            {hasReceipt ? <Icon name="receipt" size={13} tone="muted" /> : null}
          </View>
          <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>
            {dateLabel ? payerLabel + '  ·  ' + dateLabel : payerLabel}
          </Text>
        </View>

        <View style={styles.amountBlock}>
          <SMAmount value={amount} />
          {shareLabel ? (
            <Text numberOfLines={1} style={[styles.share, { color: shareColor }]}>
              {shareLabel}
            </Text>
          ) : null}
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
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: typography.bodySm, fontWeight: '700', flexShrink: 1, letterSpacing: -0.1 },
  meta: { fontSize: typography.caption },
  // Capped so a six-figure amount cannot squeeze the title to nothing.
  amountBlock: { alignItems: 'flex-end', gap: 2, maxWidth: '38%' },
  amount: { fontSize: typography.body, fontWeight: '800', letterSpacing: -0.3 },
  share: { fontSize: typography.xs, fontWeight: '600' },
});
