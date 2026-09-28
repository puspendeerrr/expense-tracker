import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMSelectFieldProps = {
  label: string;
  /** The current choice, in words. */
  value: string;
  /** A second line under the value — "4 people", "Adds up to 100%". */
  detail?: string;
  icon?: IconName;
  /** Replaces the icon well, for a choice best shown as a face. */
  leading?: ReactNode;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
};

/**
 * A field whose value is chosen from a sheet rather than typed.
 *
 * Replaces the legacy picker tile, which drew payer, split, category and payment as four
 * identical grey boxes so the form read as a grid of equal settings. Here each one reads as
 * a sentence — "Paid by · You", "Split · Everyone" — with the value in the stronger weight,
 * because the value is what someone scans the form to confirm.
 *
 * The chevron, the label and the whole-row press target say "tap to change" three ways,
 * so none of them has to be relied on alone. Announced as a button whose label includes
 * the current value, so a screen reader user hears the setting and its state together.
 */
export function SMSelectField({
  label,
  value,
  detail,
  icon,
  leading,
  onPress,
  error,
  disabled = false,
}: SMSelectFieldProps) {
  const { colors, dark } = useTheme();

  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ', ' + value + (detail ? ', ' + detail : '')}
        accessibilityHint={'Opens the ' + label.toLowerCase() + ' options'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed
              ? dark
                ? colors.surfaceElevated
                : colors.subtle
              : dark
                ? colors.surface
                : colors.surfaceElevated ?? colors.surface,
            borderColor: error ? colors.destructive : dark ? colors.borderStrong : colors.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        {leading ?? (icon ? (
          <View style={[styles.iconWell, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
            <Icon name={icon} size={16} tone="primary" />
          </View>
        ) : null)}

        <View style={styles.body}>
          <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
          <Text numberOfLines={1} style={[styles.value, { color: colors.text }]}>
            {value}
          </Text>
          {detail ? (
            <Text numberOfLines={1} style={[styles.detail, { color: colors.muted }]}>
              {detail}
            </Text>
          ) : null}
        </View>

        <Icon name="forward" size={16} tone="muted" />
      </Pressable>

      {error ? (
        <View style={styles.error}>
          <Icon name="alertCircle" size={13} tone="destructive" />
          <Text style={[styles.errorText, { color: colors.destructive }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 60,
    borderWidth: 1.5,
    borderRadius: radius.lg,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 1 },
  label: { fontSize: typography.xs, fontWeight: '600' },
  value: { fontSize: typography.body, fontWeight: '700', letterSpacing: -0.2 },
  detail: { fontSize: typography.caption },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { fontSize: typography.caption, flexShrink: 1 },
});
