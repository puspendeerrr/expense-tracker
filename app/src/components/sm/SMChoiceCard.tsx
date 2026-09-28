import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';

export type SMChoiceCardProps = {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** A short note under the description, for a caveat that belongs to this choice. */
  note?: string;
};

/**
 * One option among a few, each with enough words to choose between them.
 *
 * For choices that carry consequences — UPI versus cash, paying now versus promising to —
 * a segmented control's single word is not enough. Each card says what the option means,
 * and the selected one is marked three ways: the brand border, the filled radio, and the
 * tinted icon well, so the choice is obvious without relying on colour alone.
 */
export function SMChoiceCard({
  title,
  description,
  icon,
  selected,
  onPress,
  disabled = false,
  note,
}: SMChoiceCardProps) {
  const { colors, dark } = useTheme();
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(on, {
      toValue: selected ? 1 : 0,
      duration: motion.duration.fast,
      useNativeDriver: false,
    }).start();
  }, [selected, on]);

  const borderColor = on.interpolate({
    inputRange: [0, 1],
    outputRange: [dark ? colors.borderStrong : colors.border, colors.primary],
  });

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected, disabled }}
      accessibilityLabel={title + '. ' + description + (note ? '. ' + note : '')}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.card,
            {
              borderColor,
              borderWidth: selected ? 2 : 1.5,
              backgroundColor: selected
                ? colors.primarySubtle ?? colors.subtle
                : dark
                  ? colors.surface
                  : colors.surfaceElevated ?? colors.surface,
              opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.iconWell,
              { backgroundColor: selected ? colors.primary : colors.primarySubtle ?? colors.subtle },
            ]}
          >
            <Icon name={icon} size={17} color={selected ? colors.onPrimary ?? '#FFFFFF' : colors.primary} />
          </View>

          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
            {note ? <Text style={[styles.note, { color: colors.muted }]}>{note}</Text> : null}
          </View>

          <View
            style={[
              styles.radio,
              { borderColor: selected ? colors.primary : dark ? colors.borderStrong : colors.border },
            ]}
          >
            {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    minHeight: 72,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: typography.bodySm, fontWeight: '700' },
  description: { fontSize: typography.caption, lineHeight: 18 },
  note: { fontSize: typography.xs, fontStyle: 'italic', marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
