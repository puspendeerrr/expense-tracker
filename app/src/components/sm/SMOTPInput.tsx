import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon } from '../Icon';

export type SMOTPInputProps = {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string | undefined;
  autoFocus?: boolean;
  style?: ViewStyle;
};

export function SMOTPInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  error,
  autoFocus = true,
  style,
}: SMOTPInputProps) {
  const { colors, dark } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const completedRef = useRef(false);

  // Pulse animation for the active cursor box
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (focused && !disabled) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    } else {
      cursorOpacity.setValue(1);
    }
    return () => animation?.stop();
  }, [focused, disabled, cursorOpacity]);

  useEffect(() => {
    if (value.length < length) {
      completedRef.current = false;
    } else if (value.length === length && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const activeIndex = Math.min(value.length, length - 1);
  const hasError = Boolean(error);

  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
  };

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        accessibilityRole="none"
        accessibilityLabel={`Verification code input, current value ${value.length} of ${length} digits`}
        onPress={() => inputRef.current?.focus()}
        style={styles.boxesRow}
      >
        {digits.map((digit, index) => {
          const isFilled = digit.length > 0;
          const isActive = focused && index === activeIndex && !disabled;

          const borderColor = hasError
            ? colors.destructive
            : isActive
              ? colors.primary
              : isFilled
                ? colors.primaryLight
                : dark
                  ? colors.borderStrong
                  : colors.border;

          const boxBg = isFilled
            ? dark
              ? colors.surfaceElevated
              : colors.subtle
            : colors.surface;

          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  borderColor,
                  backgroundColor: boxBg,
                  borderWidth: isActive ? 2 : 1,
                },
                !dark ? shadows.sm : null,
              ]}
            >
              {isFilled ? (
                <Text
                  style={[
                    styles.digitText,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  {digit}
                </Text>
              ) : isActive ? (
                <Animated.View
                  style={[
                    styles.cursor,
                    {
                      backgroundColor: colors.primary,
                      opacity: cursorOpacity,
                    },
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleTextChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        accessibilityLabel="Six digit verification code"
        style={styles.hiddenInput}
      />

      {hasError ? (
        <View accessibilityLiveRegion="polite" style={styles.errorRow}>
          <Icon name="alertCircle" size={14} tone="danger" />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
    alignItems: 'center',
    width: '100%',
  },
  boxesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontSize: typography.heroSm,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cursor: {
    width: 2,
    height: 24,
    borderRadius: 1,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});

