import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { Icon, type IconName } from '../Icon';

export type SMTextInputProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string | undefined;
  helperText?: string | undefined;
  leftIcon?: IconName;
  rightAction?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  containerStyle?: ViewStyle;
};

export const SMTextInput = forwardRef<TextInput, SMTextInputProps>(function SMTextInput(
  {
    label,
    required = false,
    error,
    helperText,
    leftIcon,
    rightAction,
    clearable = false,
    onClear,
    value,
    containerStyle,
    style,
    editable = true,
    ...props
  },
  ref,
) {
  const { colors, dark } = useTheme();
  const [focused, setFocused] = useState(false);

  const hasError = Boolean(error);
  const showClear = clearable && Boolean(value) && editable;

  const borderColor = hasError
    ? colors.destructive
    : focused
      ? colors.primary
      : dark
        ? colors.borderStrong
        : colors.border;

  const backgroundColor = !editable
    ? dark
      ? colors.surface
      : '#F1F5F9'
    : focused
      ? dark
        ? colors.surfaceElevated
        : colors.surface
      : colors.surface;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View style={styles.labelRow}>
        <Text
          style={[
            styles.label,
            {
              color: hasError
                ? colors.destructive
                : focused
                  ? colors.primary
                  : colors.muted,
            },
          ]}
        >
          {label}
          {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
        </Text>
      </View>

      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor,
            opacity: editable ? 1 : 0.65,
          },
        ]}
      >
        {leftIcon ? (
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no"
            onPress={() => {
              if (ref && 'current' in ref && ref.current) {
                ref.current.focus();
              }
            }}
            style={styles.leftIconSlot}
          >
            <Icon
              name={leftIcon}
              size={18}
              tone={hasError ? 'danger' : focused ? 'primary' : 'muted'}
            />
          </Pressable>
        ) : null}

        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityState={{ disabled: !editable }}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          editable={editable}
          blurOnSubmit={props.returnKeyType === 'next' ? false : props.blurOnSubmit}
          {...props}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: typography.bodySm,
            },
            style,
          ]}
        />

        {showClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            onPress={onClear}
            hitSlop={10}
            style={styles.actionSlot}
          >
            <Icon name="close" size={16} tone="muted" />
          </Pressable>
        ) : null}

        {rightAction ? <View style={styles.actionSlot}>{rightAction}</View> : null}
      </View>

      {hasError ? (
        <View accessibilityLiveRegion="polite" style={styles.feedbackRow}>
          <Icon name="alertCircle" size={14} tone="danger" />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: colors.muted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs + 2,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderWidth: 1.5,
  },
  leftIconSlot: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: spacing.sm,
    fontWeight: '500',
  },
  actionSlot: {
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  errorText: {
    fontSize: typography.xs,
    fontWeight: '600',
    flex: 1,
  },
  helperText: {
    fontSize: typography.xs,
    fontWeight: '500',
    marginTop: 2,
  },
});

