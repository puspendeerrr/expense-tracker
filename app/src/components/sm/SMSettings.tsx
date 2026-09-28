import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

/**
 * A titled group of settings rows on one surface, with hairline dividers between them.
 *
 * One card per group rather than one per row: a column of separate cards reads as a list
 * of unrelated things, while a grouped surface says "these belong together" — the pattern
 * people already know from their phone's own settings.
 */
export function SMSettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  /** A short line under the group, for context that applies to all of it. */
  footer?: string;
  children: ReactNode;
}) {
  const { colors, dark } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.group}>
      {title ? (
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.muted }]}>
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.surface,
          {
            backgroundColor: dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
            borderColor: dark ? colors.borderStrong : colors.border,
          },
        ]}
      >
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? <Text style={[styles.footer, { color: colors.muted }]}>{footer}</Text> : null}
    </View>
  );
}

export type SMSettingsRowProps = {
  title: string;
  subtitle?: string;
  /** A short value on the right, e.g. "On", "3 devices". */
  value?: string;
  icon?: IconName;
  /** Replaces the icon well — an avatar, say. */
  leading?: ReactNode;
  /** Replaces the chevron — a switch, a badge. */
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  accessibilityHint?: string;
};

/**
 * One setting: icon, title, an optional line of explanation, and where it leads.
 *
 * A chevron appears only when the row navigates; a row that just shows a fact has none,
 * so what is tappable is never ambiguous. Destructive rows (sign out) use the red text
 * colour on the words and icon only — never a red slab — which is enough for "careful"
 * without turning a settings screen into a warning.
 */
export function SMSettingsRow({
  title,
  subtitle,
  value,
  icon,
  leading,
  trailing,
  onPress,
  destructive = false,
  accessibilityHint,
}: SMSettingsRowProps) {
  const { colors, dark } = useTheme();
  const tint = destructive ? colors.destructive : colors.primary;

  const content = (
    <>
      {leading ??
        (icon ? (
          <View
            style={[
              styles.well,
              { backgroundColor: destructive ? colors.destructiveLight : colors.primarySubtle ?? colors.subtle },
            ]}
          >
            <Icon name={icon} size={16} color={tint} />
          </View>
        ) : null)}

      <View style={styles.body}>
        <Text style={[styles.title, { color: destructive ? colors.destructive : colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>

      {value ? (
        <Text numberOfLines={1} style={[styles.value, { color: colors.muted }]}>
          {value}
        </Text>
      ) : null}

      {trailing ?? (onPress && !destructive ? <Icon name="forward" size={15} tone="muted" /> : null)}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={title + (value ? ', ' + value : '') + (subtitle ? '. ' + subtitle : '')} style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title + (value ? ', ' + value : '') + (subtitle ? '. ' + subtitle : '')}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? (dark ? colors.surfaceElevated : colors.subtle) : 'transparent' },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', paddingHorizontal: spacing.xs },
  surface: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  footer: { fontSize: typography.xs, lineHeight: 16, paddingHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.base, paddingVertical: spacing.md, minHeight: 58 },
  well: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: typography.bodySm, fontWeight: '600' },
  subtitle: { fontSize: typography.caption, lineHeight: 17 },
  value: { fontSize: typography.caption, fontWeight: '600', maxWidth: '40%' },
});
