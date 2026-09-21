import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { radius, spacing, typography } from '@/theme/tokens';

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const MODE_LABEL: Record<ThemeMode, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

export function ThemeToggle() {
  const { colors, mode, setMode } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Theme: ' + MODE_LABEL[mode] + '. Switch to ' + MODE_LABEL[NEXT_MODE[mode]]}
      onPress={() => setMode(NEXT_MODE[mode])}
      hitSlop={8}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Icon name="appearance" size={14} tone="muted" />
      <Text style={{ color: colors.text, fontSize: typography.xs, fontWeight: '700' }}>
        {MODE_LABEL[mode]}
      </Text>
    </Pressable>
  );
}

export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View style={styles.titles}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {right}
        <ThemeToggle />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  titles: { flexShrink: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  chip: {
    minHeight: 34,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
