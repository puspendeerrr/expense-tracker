import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error,
  autoFocus = true,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Fired once, when the sixth digit arrives, so the caller can submit. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
}) {
  const { colors, dark } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const completed = useRef(false);

  useEffect(() => {
    if (value.length < 6) completed.current = false;
    if (value.length === 6 && !completed.current) {
      completed.current = true;
      onComplete?.(value);
    }
  }, [value, onComplete]);

  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? '');
  const active = Math.min(value.length, 5);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={styles.boxes}
      >
        {digits.map((digit, index) => {
          const isActive = focused && index === active && !disabled;
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  backgroundColor: colors.surface,
                  borderColor: error
                    ? colors.destructive
                    : isActive
                      ? colors.primary
                      : colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
                !dark ? shadows.sm : null,
              ]}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.titleSm,
                  fontWeight: '700',
                }}
              >
                {digit}
              </Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        accessibilityLabel="Six-digit verification code"
        style={styles.hidden}
      />

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.destructive, fontSize: typography.caption, textAlign: 'center' }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  boxes: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
