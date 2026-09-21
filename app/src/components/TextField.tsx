import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { radius, spacing, typography } from '@/theme/tokens';

type Props = TextInputProps & {
  label: string;
  error?: string | undefined;
  /** Adds an eye toggle control. Keeps the field masked by default. */
  secure?: boolean;
  leftIcon?: IconName;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, secure = false, leftIcon, style, ...props },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error
    ? colors.destructive
    : focused
      ? colors.primary
      : colors.border;

  return (
    <View style={styles.field}>
      <Text
        style={{
          color: colors.muted,
          fontSize: typography.xs,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>

      <View
        style={[
          styles.row,
          {
            borderColor,
            backgroundColor: colors.surface,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        {leftIcon ? (
          <View style={styles.leftIcon}>
            <Icon
              name={leftIcon}
              size={18}
              tone={focused ? 'primary' : 'muted'}
            />
          </View>
        ) : null}

        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          secureTextEntry={secure && !revealed}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { color: colors.text, fontSize: typography.bodySm },
            style,
          ]}
          {...props}
        />

        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((value) => !value)}
            hitSlop={12}
            style={styles.reveal}
          >
            <Icon
              name={revealed ? 'eyeOff' : 'eye'}
              size={18}
              tone={revealed ? 'primary' : 'muted'}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.destructive, fontSize: typography.xs, marginTop: 2 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  leftIcon: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  reveal: {
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
