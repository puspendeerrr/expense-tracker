import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type SMOptionRowProps = {
  label: string;
  detail?: string;
  selected: boolean;
  icon?: IconName;
  /** Replaces the icon, for an option best shown as a face. */
  leading?: ReactNode;
  /**
   * 'radio' (the default) for one-of-many; 'checkbox' for a set, where several rows can be
   * on at once and each shows its own box rather than a lone check mark.
   */
  mode?: 'radio' | 'checkbox';
  onPress: () => void;
};

/**
 * One choice in a picker sheet.
 *
 * THE CHECK SITS ON THE RIGHT, and only the selected row gets a tint. The legacy row
 * marked selection by recolouring the whole row's border, which on a list of eight filters
 * meant hunting for the one box drawn slightly differently. A filled check mark is found
 * without reading.
 *
 * Reports itself as a radio to assistive technology rather than a button, so a screen
 * reader announces "selected" and the number of options, which is the thing the row is
 * actually communicating.
 */
export function SMOptionRow({
  label,
  detail,
  selected,
  icon,
  leading,
  mode = 'radio',
  onPress,
}: SMOptionRowProps) {
  const { colors, dark } = useTheme();

  return (
    <Pressable
      accessibilityRole={mode === 'checkbox' ? 'checkbox' : 'radio'}
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label + (detail ? ', ' + detail : '')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected
            ? colors.primarySubtle ?? colors.subtle
            : pressed
              ? dark
                ? colors.surfaceElevated
                : colors.subtle
              : 'transparent',
        },
      ]}
    >
      {leading ??
        (icon ? (
          <Icon name={icon} size={17} color={selected ? colors.primary : colors.muted} />
        ) : null)}

      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: selected ? colors.primary : colors.text, fontWeight: selected ? '700' : '600' },
          ]}
        >
          {label}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={[styles.detail, { color: colors.muted }]}>
            {detail}
          </Text>
        ) : null}
      </View>

      {mode === 'checkbox' ? (
        // A box on every row, filled or empty, so the set's state is readable at a glance.
        <View
          style={[
            styles.box,
            {
              borderColor: selected ? colors.primary : dark ? colors.borderStrong : colors.border,
              backgroundColor: selected ? colors.primary : 'transparent',
            },
          ]}
        >
          {selected ? <Icon name="check" size={13} color={colors.onPrimary ?? '#FFFFFF'} /> : null}
        </View>
      ) : selected ? (
        <Icon name="check" size={17} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    // 52 keeps every option inside the recommended touch target without making a
    // ten-option sheet scroll for no reason.
    minHeight: 52,
    borderRadius: radius.md,
  },
  body: { flex: 1, gap: 1 },
  label: { fontSize: typography.bodySm, letterSpacing: -0.1 },
  detail: { fontSize: typography.caption },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
