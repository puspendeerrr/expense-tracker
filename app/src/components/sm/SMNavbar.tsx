import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { Icon } from '../Icon';
import { SMProfileBadge } from './SMProfileBadge';
import { SMLogo } from './SMLogo';

export type SMNavbarProps = {
  title?: string;
  subtitle?: string;
  userName?: string;
  userAvatarUrl?: string | null;
  unreadNotifications?: number;
  onOpenDrawer?: () => void;
  onOpenNotifications?: () => void;
  /** Opens Global Search. The button is only drawn when this is given. */
  onOpenSearch?: () => void;
  onOpenProfile?: () => void;
  style?: ViewStyle;
};

export function SMNavbar({
  title,
  subtitle,
  userName = 'User',
  userAvatarUrl,
  unreadNotifications = 0,
  onOpenDrawer,
  onOpenNotifications,
  onOpenSearch,
  onOpenProfile,
  style,
}: SMNavbarProps) {
  const { colors, dark } = useTheme();

  return (
    <View
      style={[
        styles.navbar,
        {
          backgroundColor: colors.background,
          borderBottomColor: dark ? colors.borderStrong : colors.border,
        },
        style,
      ]}
    >
      {/* Left Action: Navigation Drawer Hamburger */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
        onPress={onOpenDrawer}
        hitSlop={10}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: dark ? colors.surfaceElevated : colors.surface,
            borderColor: dark ? colors.borderStrong : colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Icon name="menu" size={20} tone="default" />
      </Pressable>

      {/* Center Branding / Title */}
      <View style={styles.centerBlock}>
        {title ? (
          <View style={styles.titleWrap}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.text }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: colors.muted }]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.brandRow}>
            <SMLogo size="sm" align="left" />
            {subtitle ? (
              <View style={[styles.badgePill, { backgroundColor: dark ? '#064E3B44' : '#ECFDF5' }]}>
                <Text style={[styles.badgePillText, { color: colors.primary }]}>
                  {subtitle}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Right Actions: Notifications + Profile */}
      <View style={styles.rightGroup}>
        {onOpenSearch ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={onOpenSearch}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: dark ? colors.surfaceElevated : colors.surface,
                borderColor: dark ? colors.borderStrong : colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon name="search" size={19} tone="default" />
          </Pressable>
        ) : null}

        {onOpenNotifications ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotifications > 0
                ? `${unreadNotifications} unread notifications`
                : 'Notifications'
            }
            onPress={onOpenNotifications}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: dark ? colors.surfaceElevated : colors.surface,
                borderColor: dark ? colors.borderStrong : colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon name="notifications" size={19} tone="default" />
            {unreadNotifications > 0 ? (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        <SMProfileBadge
          name={userName}
          avatarUrl={userAvatarUrl}
          size={38}
          onPress={onOpenProfile}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    gap: spacing.sm,
    minHeight: 60,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  titleWrap: {
    gap: 1,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgePill: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgePillText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
