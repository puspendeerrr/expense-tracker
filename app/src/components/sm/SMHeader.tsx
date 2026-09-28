import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon } from '../Icon';

export type SMHeaderProps = {
  onBack?: () => void;
  backLabel?: string;
  stepText?: string;
  rightElement?: React.ReactNode;
};

export function SMHeader({
  onBack,
  backLabel = 'Go back',
  stepText,
  rightElement,
}: SMHeaderProps) {
  const { colors, dark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.leftSlot}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backBtn,
              {
                backgroundColor: colors.surface,
                borderColor: dark ? colors.borderStrong : colors.border,
                opacity: pressed ? 0.75 : 1,
              },
              !dark ? shadows.sm : null,
            ]}
          >
            <Icon name="back" size={18} tone="default" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.centerSlot}>
        {stepText ? (
          <View
            style={[
              styles.stepBadge,
              {
                backgroundColor: dark ? colors.subtle : '#ECFDF5',
                borderColor: dark ? colors.border : '#A7F3D0',
              },
            ]}
          >
            <Text
              style={[
                styles.stepText,
                {
                  color: colors.primary,
                },
              ]}
            >
              {stepText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.rightSlot}>{rightElement}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    minHeight: 44,
    width: '100%',
  },
  leftSlot: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  stepText: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

