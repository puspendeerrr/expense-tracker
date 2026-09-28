import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon, type IconName } from '../Icon';

export type SMButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type SMButtonSize = 'sm' | 'md' | 'lg';

export type SMButtonProps = {
  label: string;
  onPress: () => void;
  variant?: SMButtonVariant;
  size?: SMButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function SMButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
  labelStyle,
  accessibilityLabel,
  accessibilityHint,
}: SMButtonProps) {
  const { colors, dark } = useTheme();
  const inactive = disabled || loading;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (inactive) return;
    Animated.timing(scaleAnim, {
      toValue: motion.scale.pressed,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 250,
      useNativeDriver: true,
    }).start();
  };

  const sizeStyles = {
    sm: {
      minHeight: 38,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      fontSize: typography.caption,
      iconSize: 16,
      gap: spacing.xs + 2,
    },
    md: {
      minHeight: 50,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      fontSize: typography.bodySm,
      iconSize: 18,
      gap: spacing.sm,
    },
    lg: {
      minHeight: 56,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      fontSize: typography.body,
      iconSize: 20,
      gap: spacing.sm + 2,
    },
  }[size];

  // Colors per variant
  const palette: Record<
    SMButtonVariant,
    { background: string; border: string; text: string; shadow: boolean }
  > = {
    primary: {
      background: colors.primary,
      border: colors.primary,
      text: colors.onPrimary,
      shadow: !dark,
    },
    secondary: {
      background: dark ? colors.surfaceElevated : colors.subtle,
      border: dark ? colors.borderStrong : colors.border,
      text: colors.text,
      shadow: false,
    },
    outline: {
      background: 'transparent',
      border: colors.borderStrong,
      text: colors.text,
      shadow: false,
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      text: colors.primary,
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
  const displayLabel = loading && loadingLabel ? loadingLabel : label;

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth ? styles.fullWidth : styles.autoWidth,
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: sizeStyles.minHeight,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            paddingVertical: sizeStyles.paddingVertical,
            gap: sizeStyles.gap,
            backgroundColor: tone.background,
            borderColor: tone.border,
            opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          },
          tone.shadow && !disabled ? shadows.sm : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size={size === 'sm' ? 'small' : 'small'}
            color={tone.text}
            style={styles.spinner}
          />
        ) : null}

        {!loading && icon && iconPosition === 'left' ? (
          <Icon name={icon} size={sizeStyles.iconSize} color={tone.text} />
        ) : null}

        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: tone.text,
              fontSize: sizeStyles.fontSize,
            },
            labelStyle,
          ]}
        >
          {displayLabel}
        </Text>

        {!loading && icon && iconPosition === 'right' ? (
          <Icon name={icon} size={sizeStyles.iconSize} color={tone.text} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  autoWidth: {
    alignSelf: 'flex-start',
  },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  spinner: {
    marginRight: spacing.xs,
  },
});

