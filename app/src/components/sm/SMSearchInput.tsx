import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { Icon } from '../Icon';

export type SMSearchInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  style?: ViewStyle;
  /** What a screen reader calls the field. Defaults to the placeholder. */
  accessibilityLabel?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
};

export function SMSearchInput({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search groups…',
  style,
  accessibilityLabel,
  autoFocus = false,
  onSubmitEditing,
}: SMSearchInputProps) {
  const { colors, dark } = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const hasValue = value.length > 0;

  const handleClear = () => {
    onChangeText('');
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: dark ? colors.surfaceElevated : colors.surface,
          borderColor: focused
            ? colors.primary
            : dark
              ? colors.borderStrong
              : colors.border,
        },
        style,
      ]}
    >
      <Pressable
        onPress={() => inputRef.current?.focus()}
        hitSlop={8}
        style={styles.searchIconSlot}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Icon
          name="search"
          size={18}
          tone={focused ? 'primary' : 'muted'}
        />
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityRole="search"
        accessibilityLabel={accessibilityLabel ?? placeholder.replace(/…$/, '')}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          {
            color: colors.text,
            fontSize: typography.bodySm,
          },
        ]}
      />

      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search text"
          onPress={handleClear}
          hitSlop={10}
          style={styles.clearSlot}
        >
          <View
            style={[
              styles.clearCircle,
              { backgroundColor: dark ? colors.surface : colors.subtle },
            ]}
          >
            <Icon name="close" size={13} tone="muted" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    width: '100%',
  },
  searchIconSlot: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: spacing.xs,
    fontWeight: '500',
  },
  clearSlot: {
    paddingLeft: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
