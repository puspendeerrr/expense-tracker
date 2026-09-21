import { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Group } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Badge } from './ui';
import { motion, radius, shadows, spacing, typography } from '@/theme/tokens';

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function GroupCard({ group, onPress }: { group: Group; onPress?: () => void }) {
  const { colors, dark } = useTheme();
  const members = group.memberCount;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    if (!onPress) return;
    Animated.timing(scaleAnim, {
      toValue: motion.scale.pressed,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={
          group.name + (members === undefined ? '' : ', ' + members + (members === 1 ? ' member' : ' members'))
        }
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
          },
          !dark ? shadows.sm : null,
        ]}
      >
        {group.avatarUrl ? (
          <Image source={{ uri: group.avatarUrl }} style={styles.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
            <Text style={{ color: colors.primary, fontSize: typography.bodySm, fontWeight: '800' }}>
              {initials(group.name)}
            </Text>
          </View>
        )}

        <View style={styles.body}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}
          >
            {group.name}
          </Text>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
              {[
                members === undefined ? null : members + (members === 1 ? ' member' : ' members'),
                group.currency,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          {group.role === 'creator' ? (
            <Badge label="Owner" tone="positive" />
          ) : null}
          <Icon name="forward" size={16} tone="muted" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 74,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xxs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
