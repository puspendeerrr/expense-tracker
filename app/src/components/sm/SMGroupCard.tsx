import React, { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { Group } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon } from '../Icon';

export type SMGroupCardProps = {
  group: Group;
  onPress?: () => void;
  style?: ViewStyle;
};

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function SMGroupCard({ group, onPress, style }: SMGroupCardProps) {
  const { colors, dark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const members = group.memberCount;
  const isOwner = group.role === 'creator';
  const hasCover = Boolean(group.coverUrl);

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.timing(scaleAnim, {
      toValue: motion.scale.pressed,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${group.name}, ${isOwner ? 'Owner, ' : ''}${members ?? 0} members, currency ${group.currency}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: dark ? colors.surfaceElevated : colors.surface,
            borderColor: dark ? colors.borderStrong : colors.border,
            opacity: pressed ? 0.88 : 1,
          },
          !dark ? shadows.sm : null,
        ]}
      >
        {/* Optional Cover Strip */}
        {hasCover ? (
          <View style={styles.coverWrap}>
            <Image
              source={{ uri: group.coverUrl! }}
              style={styles.coverImage}
              accessibilityIgnoresInvertColors
            />
            <View
              style={[
                styles.coverScrim,
                { backgroundColor: dark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0, 0, 0, 0.15)' },
              ]}
            />
          </View>
        ) : null}

        <View style={styles.cardContent}>
          {/* Left Avatar Slot */}
          {group.avatarUrl ? (
            <Image
              source={{ uri: group.avatarUrl }}
              style={[
                styles.avatar,
                { borderColor: dark ? colors.borderStrong : colors.border },
              ]}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.fallbackAvatar,
                {
                  backgroundColor: dark ? '#064E3B33' : '#ECFDF5',
                  borderColor: dark ? '#065F46' : '#A7F3D0',
                },
              ]}
            >
              <Text style={[styles.initialsText, { color: colors.primary }]}>
                {getInitials(group.name)}
              </Text>
            </View>
          )}

          {/* Body Section */}
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[styles.groupName, { color: colors.text }]}
              >
                {group.name}
              </Text>
              {isOwner ? (
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: dark ? '#064E3B44' : '#ECFDF5',
                      borderColor: dark ? '#065F46' : '#A7F3D0',
                    },
                  ]}
                >
                  <Text style={[styles.roleText, { color: colors.primary }]}>
                    Owner
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Description or Meta row */}
            {group.description ? (
              <Text
                numberOfLines={1}
                style={[styles.descText, { color: colors.muted }]}
              >
                {group.description}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="users" size={12} tone="muted" />
                <Text style={[styles.metaText, { color: colors.muted }]}>
                  {members === undefined
                    ? '0 members'
                    : members === 1
                      ? '1 member'
                      : `${members} members`}
                </Text>
              </View>

              <Text style={[styles.metaDot, { color: colors.muted }]}>•</Text>

              <View style={styles.currencyPill}>
                <Text style={[styles.currencyText, { color: colors.muted }]}>
                  {group.currency}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Chevron Action */}
          <View
            style={[
              styles.chevronCircle,
              {
                backgroundColor: dark ? colors.surface : colors.subtle,
                borderColor: dark ? colors.borderStrong : colors.border,
              },
            ]}
          >
            <Icon name="forward" size={15} tone="muted" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  coverWrap: {
    height: 48,
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverScrim: {
    ...StyleSheet.absoluteFill,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  fallbackAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: typography.bodySm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  groupName: {
    fontSize: typography.body,
    fontWeight: '700',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  descText: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  metaDot: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  currencyPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.xs,
  },
  currencyText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
