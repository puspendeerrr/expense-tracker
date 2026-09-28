import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMToggleRowProps = {
  label: string;
  description?: string;
  icon?: IconName;
  value: boolean;
  onChange: (next: boolean) => void;
  /** True while this row's change is being saved. */
  saving?: boolean;
  disabled?: boolean;
  /** Shown under the row when its last save failed. */
  error?: string | null;
  /** A small tag beside the label, e.g. "Recommended". */
  tag?: string;
};

/**
 * A setting that is on or off.
 *
 * The whole row is the target, not just the switch, and it is announced as a switch with
 * its label and state — "Settlements, on" — rather than an anonymous toggle. While a
 * change is saving, a spinner replaces the switch so it is clear the tap registered and
 * the result is not yet known; if the save fails, the row says so underneath and the
 * switch shows the server's value again.
 */
export function SMToggleRow({
  label,
  description,
  icon,
  value,
  onChange,
  saving = false,
  disabled = false,
  error,
  tag,
}: SMToggleRowProps) {
  const { colors, dark } = useTheme();
  const blocked = disabled || saving;

  return (
    <View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label + (description ? '. ' + description : '')}
        accessibilityState={{ checked: value, disabled: blocked, busy: saving }}
        disabled={blocked}
        onPress={() => onChange(!value)}
        style={({ pressed }) => [styles.row, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
      >
        {icon ? (
          <View style={[styles.well, { backgroundColor: colors.primarySubtle ?? colors.subtle }]}>
            <Icon name={icon} size={16} tone="primary" />
          </View>
        ) : null}

        <View style={styles.body}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
            {tag ? (
              <View style={[styles.tag, { backgroundColor: dark ? colors.surfaceElevated : colors.subtle }]}>
                <Text style={[styles.tagText, { color: colors.muted }]}>{tag}</Text>
              </View>
            ) : null}
          </View>
          {description ? (
            <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
          ) : null}
        </View>

        <View style={styles.control}>
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              value={value}
              onValueChange={onChange}
              disabled={blocked}
              trackColor={{ false: dark ? colors.borderStrong : colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
              // The row carries the label; the switch itself stays out of the reading order.
              importantForAccessibility="no"
              accessibilityElementsHidden
            />
          )}
        </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 60 },
  well: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  label: { fontSize: typography.bodySm, fontWeight: '700' },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  tagText: { fontSize: typography.xs, fontWeight: '700' },
  description: { fontSize: typography.caption, lineHeight: 18 },
  control: { minWidth: 52, alignItems: 'flex-end' },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.sm },
  errorText: { fontSize: typography.caption, flexShrink: 1 },
});
