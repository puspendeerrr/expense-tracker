import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { Icon, type IconName } from '../Icon';
import { SMLogo } from './SMLogo';
import { SMProfileBadge } from './SMProfileBadge';

export type DrawerRoute = 'groups' | 'notifications' | 'ai' | 'profile' | 'settings' | 'admin';

export type SMMobileDrawerProps = {
  visible: boolean;
  onClose: () => void;
  currentRoute?: DrawerRoute;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string | null;
  isAdmin?: boolean;
  /** Adds the admin console. Pass the server's `admin.access` capability, not the role. */
  showAdminConsole?: boolean;
  unreadCount?: number;
  onNavigate: (route: DrawerRoute) => void;
  onSignOut?: () => void;
};

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 320);

export function SMMobileDrawer({
  visible,
  onClose,
  currentRoute = 'groups',
  userName = 'User',
  userEmail,
  userAvatarUrl,
  isAdmin = false,
  showAdminConsole = false,
  unreadCount = 0,
  onNavigate,
  onSignOut,
}: SMMobileDrawerProps) {
  const { colors, dark, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, animValue]);

  // Handle hardware back button on Android when drawer is open
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const handleSelect = (destination: DrawerRoute) => {
    onClose();
    setTimeout(() => {
      onNavigate(destination);
    }, 150);
  };

  const navItems: {
    id: DrawerRoute;
    label: string;
    icon: IconName;
    badge?: string | number | undefined;
    tag?: string | undefined;
  }[] = [
    { id: 'groups', label: 'Groups', icon: 'group' },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'notifications',
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
    },
    { id: 'ai', label: 'SplitMoney AI', icon: 'ai', tag: 'AI' },
    { id: 'profile', label: 'Your Profile', icon: 'person' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
    ...(showAdminConsole ? [{ id: 'admin' as const, label: 'Admin console', icon: 'shield' as const }] : []),
  ];

  const themeModes: { key: ThemeMode; label: string; icon: IconName }[] = [
    { key: 'system', label: 'Auto', icon: 'smartphone' },
    { key: 'light', label: 'Light', icon: 'sun' },
    { key: 'dark', label: 'Dark', icon: 'moon' },
  ];

  if (!visible) return null;

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const scrimOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* Scrim backdrop */}
        <Animated.View
          style={[
            styles.scrim,
            {
              opacity: scrimOpacity,
            },
          ]}
        >
          <Pressable
            style={styles.scrimPressable}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
          />
        </Animated.View>

        {/* Sliding Drawer Container */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: dark ? colors.surface : colors.background,
              borderColor: dark ? colors.borderStrong : colors.border,
              paddingTop: Math.max(insets.top, spacing.md),
              paddingBottom: Math.max(insets.bottom, spacing.md),
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Top Brand Bar with Close Button */}
          <View style={styles.topBar}>
            <SMLogo size="sm" align="left" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close navigation drawer"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: dark ? colors.surfaceElevated : colors.surface,
                  borderColor: dark ? colors.borderStrong : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Icon name="close" size={18} tone="muted" />
            </Pressable>
          </View>

          {/* User Profile Summary */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View profile for ${userName}`}
            onPress={() => handleSelect('profile')}
            style={({ pressed }) => [
              styles.userCard,
              {
                backgroundColor: dark ? colors.surfaceElevated : colors.surface,
                borderColor: dark ? colors.borderStrong : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <SMProfileBadge
              name={userName}
              avatarUrl={userAvatarUrl}
              size={48}
              onPress={() => handleSelect('profile')}
            />
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.userName, { color: colors.text }]}
                >
                  {userName}
                </Text>
                {isAdmin ? (
                  <View style={[styles.adminPill, { backgroundColor: dark ? '#78350F44' : '#FEF3C7' }]}>
                    <Text style={styles.adminText}>Admin</Text>
                  </View>
                ) : null}
              </View>
              {userEmail ? (
                <Text
                  numberOfLines={1}
                  style={[styles.userEmail, { color: colors.muted }]}
                >
                  {userEmail}
                </Text>
              ) : null}
            </View>
          </Pressable>

          {/* Navigation Items List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.navScroll}
          >
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              NAVIGATION
            </Text>

            {navItems.map((item) => {
              const isSelected = currentRoute === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={item.label}
                  onPress={() => handleSelect(item.id)}
                  style={({ pressed }) => [
                    styles.navItem,
                    {
                      backgroundColor: isSelected
                        ? dark
                          ? '#064E3B33'
                          : '#ECFDF5'
                        : 'transparent',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  {/* Active Indicator Bar */}
                  {isSelected ? (
                    <View
                      style={[
                        styles.activeIndicator,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  ) : null}

                  <View style={styles.iconSlot}>
                    <Icon
                      name={item.icon}
                      size={20}
                      tone={isSelected ? 'primary' : 'muted'}
                    />
                  </View>

                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: isSelected ? colors.primary : colors.text,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>

                  {item.badge ? (
                    <View
                      style={[
                        styles.badgePill,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}

                  {item.tag ? (
                    <View
                      style={[
                        styles.tagPill,
                        { backgroundColor: dark ? '#064E3B44' : '#D1FAE5' },
                      ]}
                    >
                      <Text
                        style={[styles.tagText, { color: colors.primary }]}
                      >
                        {item.tag}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Drawer Footer: Theme Selector & Sign Out */}
          <View
            style={[
              styles.footer,
              { borderTopColor: dark ? colors.borderStrong : colors.border },
            ]}
          >
            {/* Theme Toggle Strip */}
            <View style={styles.themeRow}>
              <Text style={[styles.themeLabel, { color: colors.muted }]}>
                Theme
              </Text>
              <View
                style={[
                  styles.themeToggleGroup,
                  {
                    backgroundColor: dark
                      ? colors.surfaceElevated
                      : colors.subtle,
                    borderColor: dark ? colors.borderStrong : colors.border,
                  },
                ]}
              >
                {themeModes.map((t) => {
                  const active = mode === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Set theme to ${t.label}`}
                      onPress={() => setMode(t.key)}
                      style={[
                        styles.themeOption,
                        active
                          ? {
                              backgroundColor: dark
                                ? colors.surface
                                : colors.surface,
                              borderColor: dark
                                ? colors.borderStrong
                                : colors.border,
                              borderWidth: 1,
                            }
                          : null,
                      ]}
                    >
                      <Icon
                        name={t.icon}
                        size={13}
                        tone={active ? 'primary' : 'muted'}
                      />
                      <Text
                        style={[
                          styles.themeOptionText,
                          {
                            color: active ? colors.text : colors.muted,
                            fontWeight: active ? '700' : '500',
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Sign Out CTA */}
            {onSignOut ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out of SplitMoney"
                onPress={() => {
                  onClose();
                  onSignOut();
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.signOutBtn,
                  {
                    borderColor: dark ? colors.borderStrong : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Icon name="signOut" size={17} tone="danger" />
                <Text
                  style={[styles.signOutText, { color: colors.destructive }]}
                >
                  Sign Out
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  scrimPressable: {
    flex: 1,
  },
  drawer: {
    height: '100%',
    borderRightWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userName: {
    fontSize: typography.bodySm,
    fontWeight: '700',
  },
  adminPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  adminText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: typography.caption,
    fontWeight: '500',
  },
  navScroll: {
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.md,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3.5,
    borderRadius: radius.pill,
  },
  iconSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  navLabel: {
    flex: 1,
    fontSize: typography.bodySm,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  themeToggleGroup: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  themeOptionText: {
    fontSize: 11,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
});
