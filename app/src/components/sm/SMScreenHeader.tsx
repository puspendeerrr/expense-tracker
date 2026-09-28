import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMScreenHeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

export type SMScreenHeaderProps = {
  title: string;
  /** A second, quieter line — usually the group this screen belongs to. */
  subtitle?: string;
  onBack: () => void;
  /**
   * 'back' for a screen pushed on top of another; 'close' for a task opened to be finished
   * or abandoned, like a form. The icon tells the person which kind of exit this is.
   */
  variant?: 'back' | 'close';
  action?: SMScreenHeaderAction;
};

/**
 * The header for a screen pushed inside the app.
 *
 * Replaces the legacy ScreenHeader. Top-level destinations use SMNavbar, with the drawer,
 * bell and profile; a pushed screen needs none of that — only a way back and a statement of
 * where you are. So this is deliberately spare: exit on the left, title centred, at most
 * one action on the right.
 *
 * THE TITLE IS TRULY CENTRED. Both side slots are always rendered at the same width, even
 * when one is empty, so a title does not drift off-centre on screens without an action and
 * the header reads identically everywhere.
 */
export function SMScreenHeader({
  title,
  subtitle,
  onBack,
  variant = 'back',
  action,
}: SMScreenHeaderProps) {
  const { colors, dark } = useTheme();

  const button = (pressed: boolean) => [
    styles.button,
    {
      backgroundColor: dark ? colors.surfaceElevated ?? colors.surface : colors.surface,
      borderColor: dark ? colors.borderStrong : colors.border,
      opacity: pressed ? 0.75 : 1,
    },
  ];

  return (
    <View style={[styles.header, { borderBottomColor: dark ? colors.borderStrong : colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={variant === 'close' ? 'Cancel' : 'Back'}
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => button(pressed)}
      >
        <Icon name={variant === 'close' ? 'close' : 'back'} size={20} />
      </Pressable>

      <View style={styles.titleBlock}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={10}
          style={({ pressed }) => button(pressed)}
        >
          <Icon name={action.icon} size={20} />
        </Pressable>
      ) : (
        // Same width as the back button, so the title stays centred.
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 44, height: 44 },
  titleBlock: { flex: 1, alignItems: 'center' },
  title: { fontSize: typography.body, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { fontSize: typography.xs, fontWeight: '500' },
});
