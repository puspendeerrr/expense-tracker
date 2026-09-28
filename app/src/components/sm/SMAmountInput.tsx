import React, { forwardRef, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Icon } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';
import { sanitizeAmount } from '@/lib/amountInput';

export type SMAmountInputProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Currency symbol shown before the figure. The group's currency, never assumed. */
  symbol?: string;
  error?: string;
  /**
   * The amount as it will be recorded, already formatted — "₹1,240.00". Shown under the
   * field as confirmation. The caller formats it; this component never parses money.
   */
  confirmation?: string;
};


/**
 * The amount field for an expense.
 *
 * The most important number on the form, so the largest type on it — set in tabular
 * figures so the digits do not shift sideways as they are typed. The currency symbol is
 * part of the field rather than a separate label, because "₹" next to the figure is how a
 * person reads a price.
 */
export const SMAmountInput = forwardRef<TextInput, SMAmountInputProps>(function SMAmountInput(
  { label, value, onChangeText, symbol = '₹', error, confirmation, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors, dark } = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useRef(new Animated.Value(0)).current;
  const local = useRef<TextInput>(null);

  const animate = (to: number): void => {
    Animated.timing(focus, {
      toValue: to,
      duration: motion.duration.fast,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = error
    ? colors.destructive
    : focus.interpolate({
        inputRange: [0, 1],
        outputRange: [dark ? colors.borderStrong : colors.border, colors.primary],
      });

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>

      <Pressable
        // The whole box focuses the input, not just the digits' exact bounds.
        onPress={() => local.current?.focus()}
        accessible={false}
      >
        <Animated.View
          style={[
            styles.box,
            {
              borderColor,
              backgroundColor: dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
              borderWidth: focused || error ? 2 : 1.5,
            },
          ]}
        >
          <Text style={[styles.symbol, { color: value ? colors.text : colors.muted }]}>
            {symbol}
          </Text>

          <TextInput
            ref={(node) => {
              local.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            value={value}
            onChangeText={(next) => onChangeText(sanitizeAmount(next))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            accessibilityLabel={label}
            accessibilityHint={confirmation ? 'Records ' + confirmation : undefined}
            onFocus={(event) => {
              setFocused(true);
              animate(1);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              animate(0);
              onBlur?.(event);
            }}
            maxLength={13}
            style={[styles.input, { color: colors.text }]}
            {...rest}
          />

          {value ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear amount"
              onPress={() => onChangeText('')}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Icon name="close" size={16} tone="muted" />
            </Pressable>
          ) : null}
        </Animated.View>
      </Pressable>

      {error ? (
        <View style={styles.message}>
          <Icon name="alertCircle" size={13} tone="destructive" />
          <Text style={[styles.messageText, { color: colors.destructive }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        </View>
      ) : confirmation ? (
        <Text style={[styles.messageText, { color: colors.muted }]}>
          {'You’ll record ' + confirmation}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { fontSize: typography.bodySm, fontWeight: '600' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 68,
    borderRadius: radius.lg,
  },
  symbol: { fontSize: typography.heroSm, fontWeight: '700' },
  input: {
    flex: 1,
    fontSize: typography.hero,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.sm,
  },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  messageText: { fontSize: typography.caption, lineHeight: 18, flexShrink: 1 },
});
