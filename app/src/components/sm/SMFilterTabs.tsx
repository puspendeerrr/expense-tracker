import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

export type GroupFilterType = 'all' | 'created' | 'member';

export type FilterOption = {
  id: GroupFilterType;
  label: string;
  count?: number;
};

export type SMFilterTabsProps = {
  selected: GroupFilterType;
  onSelect: (type: GroupFilterType) => void;
  options: FilterOption[];
  style?: ViewStyle;
};

export function SMFilterTabs({
  selected,
  onSelect,
  options,
  style,
}: SMFilterTabsProps) {
  const { colors, dark } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${option.label} filter${option.count !== undefined ? `, ${option.count} groups` : ''}`}
              onPress={() => onSelect(option.id)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.tabPill,
                {
                  backgroundColor: isSelected
                    ? dark
                      ? '#064E3B44'
                      : '#ECFDF5'
                    : dark
                      ? colors.surfaceElevated
                      : colors.surface,
                  borderColor: isSelected
                    ? colors.primary
                    : dark
                      ? colors.borderStrong
                      : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isSelected ? colors.primary : colors.muted,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {option.label}
              </Text>
              {option.count !== undefined ? (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : dark
                          ? colors.surface
                          : colors.subtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : colors.muted,
                      },
                    ]}
                  >
                    {option.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: 2,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  tabLabel: {
    fontSize: typography.caption,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
