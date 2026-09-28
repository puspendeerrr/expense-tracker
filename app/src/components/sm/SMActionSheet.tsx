import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SMSheet } from './SMSheet';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';

export type SMAction = {
  id: string;
  label: string;
  /** One quiet line under the label, for actions whose consequence is not obvious. */
  description?: string;
  icon: IconName;
  onPress: () => void;
  /** Renders below a divider, in the destructive tone. */
  destructive?: boolean;
  disabled?: boolean;
};

export type SMActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: SMAction[];
};

/**
 * A menu of things you can do, as a bottom sheet.
 *
 * Replaces the legacy `Sheet`-of-stacked-buttons and every `Alert.alert` menu. A column of
 * full-width buttons gives each action the same visual weight, so "Invite members" and
 * "Leave group" shout equally loudly; these are rows with an icon and a label, and the
 * destructive ones are separated by a divider and tinted.
 *
 * The separation is structural, not cosmetic: `destructive` actions are pulled to the
 * bottom regardless of the order they are passed in, so a caller cannot accidentally place
 * "Leave group" where somebody's thumb is already travelling.
 */
export function SMActionSheet({ visible, onClose, title, subtitle, actions }: SMActionSheetProps) {
  const { colors, dark } = useTheme();

  const safe = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  const run = (action: SMAction): void => {
    if (action.disabled) return;
    // Closed first so the sheet's exit and the navigation it triggers overlap, rather
    // than the user watching a sheet slide away before anything happens.
    onClose();
    action.onPress();
  };

  return (
    <SMSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View style={styles.group}>
        {safe.map((action) => (
          <ActionRow key={action.id} action={action} onRun={run} />
        ))}
      </View>

      {destructive.length > 0 ? (
        <>
          <View
            style={[styles.divider, { backgroundColor: dark ? colors.borderStrong : colors.border }]}
          />
          <View style={styles.group}>
            {destructive.map((action) => (
              <ActionRow key={action.id} action={action} onRun={run} />
            ))}
          </View>
        </>
      ) : null}
    </SMSheet>
  );
}

function ActionRow({ action, onRun }: { action: SMAction; onRun: (action: SMAction) => void }) {
  const { colors, dark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const tint = action.destructive ? colors.destructive : colors.text;
  const iconTint = action.destructive ? colors.destructive : colors.primary;
  const wash = action.destructive
    ? colors.destructiveSubtle ?? colors.subtle
    : colors.primarySubtle ?? colors.subtle;

  const press = (to: number): void => {
    Animated.timing(scale, {
      toValue: to,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityHint={action.description}
        accessibilityState={{ disabled: action.disabled }}
        disabled={action.disabled}
        onPress={() => onRun(action)}
        onPressIn={() => press(motion.scale.pressed)}
        onPressOut={() => press(1)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed
              ? dark
                ? colors.surface
                : colors.subtle
              : 'transparent',
            opacity: action.disabled ? 0.45 : 1,
          },
        ]}
      >
        <View style={[styles.iconWell, { backgroundColor: wash }]}>
          <Icon name={action.icon} size={18} color={iconTint} />
        </View>

        <View style={styles.rowBody}>
          <Text style={[styles.label, { color: tint }]}>{action.label}</Text>
          {action.description ? (
            <Text style={[styles.description, { color: colors.muted }]}>{action.description}</Text>
          ) : null}
        </View>

        {action.destructive ? null : <Icon name="forward" size={16} tone="muted" />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xxs },
  divider: { height: 1, marginVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Comfortably past the 48dp guidance, because these rows sit near a thumb.
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 1 },
  label: { fontSize: typography.body, fontWeight: '600' },
  description: { fontSize: typography.caption, lineHeight: 17 },
});
