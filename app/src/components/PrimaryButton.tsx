import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, shadows, spacing, typography } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Shows a spinner and stops further presses; a button already working is not tappable. */
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /**
   * Spoken instead of `label`. Needed when the label is a glyph or icon.
   */
  accessibilityLabel?: string;
  /**
   * An icon before the label. When `iconOnly` is set the label is dropped from the
   * button and kept as its accessible name, which is how a square/pill icon button stays
   * announceable without showing text.
   */
  icon?: IconName;
  iconOnly?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  icon,
  iconOnly = false,
}: Props) {
  const { colors, dark } = useTheme();
  const inactive = disabled || loading;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    if (inactive) return;
    Animated.timing(scaleAnim, {
      toValue: motion.scale.pressed,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const palette: Record<
    ButtonVariant,
    { background: string; border: string; text: string; shadow: boolean }
  > = {
    primary: {
      background: colors.primary,
      border: colors.primary,
      text: colors.onPrimary,
      shadow: !dark,
    },
    secondary: {
      background: colors.surface,
      border: colors.border,
      text: colors.text,
      shadow: false,
    },
    danger: {
      background: colors.destructiveLight,
      border: colors.destructive,
      text: colors.destructive,
      shadow: false,
    },
  };
  const tone = palette[variant];

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: tone.background,
            borderColor: tone.border,
            opacity: inactive ? 0.55 : pressed ? 0.9 : 1,
          },
          tone.shadow ? shadows.sm : null,
          iconOnly ? styles.iconOnly : styles.standard,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={tone.text} />
        ) : (
          <>
            {icon ? (
              <Icon
                name={icon}
                size={iconOnly ? 18 : 16}
                color={tone.text}
              />
            ) : null}
            {iconOnly ? null : (
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: tone.text, fontSize: typography.bodySm },
                ]}
              >
                {label}
              </Text>
            )}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  standard: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  iconOnly: {
    minHeight: 44,
    minWidth: 44,
    padding: spacing.sm,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
