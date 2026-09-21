import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { ScreenHeader, SettingsGroup, SettingsRow } from '@/components/ScreenHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Avatar, Card } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/auth/AuthProvider';
import { useNotifications } from '@/notifications/NotificationProvider';
import { useAds, adsConfig } from '@/features/ads';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { runtime } from '@/constants/environment';
import { spacing, typography } from '@/theme/tokens';

const MODE_LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export default function SettingsScreen() {
  const { colors, mode } = useTheme();
  const { user, signOut } = useAuth();
  const { unreadCount, push, permission } = useNotifications();
  const { status: adsStatus, privacyOptionsRequired, showPrivacyOptions } = useAds();
  const router = useRouter();

  const notificationsSummary = (): string => {
    if (!permission.granted) return 'Disabled in Android settings';
    if (push.status === 'registered') return 'Active on this device';
    if (push.status === 'unsupported') return 'In-app notification centre only';
    if (push.status === 'error') return 'Registration error — tap to retry';
    return 'Tap to enable';
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* User Card Shortcut */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push('/profile')}
        >
          <Card style={styles.identityCard}>
            <Avatar name={user?.fullName ?? '?'} size={52} />
            <View style={styles.identityBody}>
              <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '700' }}>
                {user?.fullName ?? 'User'}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
                {user?.email ?? ''}
              </Text>
            </View>
            <Icon name="forward" size={18} tone="muted" />
          </Card>
        </Pressable>

        <SettingsGroup title="Account">
          <SettingsRow
            label="Your Profile"
            detail="Name, email and account status"
            onPress={() => router.push('/profile')}
          />
        </SettingsGroup>

        <SettingsGroup title="Notifications">
          <SettingsRow
            label="Notification Preferences"
            detail={notificationsSummary()}
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsRow
            label="Notification Centre"
            value={unreadCount > 0 ? String(unreadCount) : undefined}
            detail={unreadCount > 0 ? unreadCount + ' unread alerts' : 'View all updates'}
            onPress={() => router.push('/notifications')}
          />
        </SettingsGroup>

        <SettingsGroup title="Security & Access">
          <SettingsRow
            label="Devices & Active Sessions"
            detail="Manage phones and browsers signed into your account"
            onPress={() => router.push('/settings/devices')}
          />
          <SettingsRow
            label="Security Event Log"
            detail="Review recent sign-ins and security events"
            onPress={() => router.push('/settings/security')}
          />
        </SettingsGroup>

        {adsConfig.enabled && privacyOptionsRequired ? (
          <SettingsGroup title="Privacy">
            <SettingsRow
              label="Ad Privacy Choices"
              detail="Review or change advertising personalization"
              onPress={() => void showPrivacyOptions()}
            />
            {adsConfig.useTestAds ? (
              <SettingsRow
                label="Ad Mode"
                value="Test"
                detail="Showing test advertisements only."
              />
            ) : null}
          </SettingsGroup>
        ) : null}

        {adsConfig.enabled && adsConfig.useTestAds && !privacyOptionsRequired ? (
          <SettingsGroup title="Privacy">
            <SettingsRow
              label="Ad Mode"
              value={adsStatus === 'ready' ? 'Test' : 'Off'}
              detail="Showing test advertisements only."
            />
          </SettingsGroup>
        ) : null}

        <SettingsGroup title="Appearance">
          <SettingsRow
            label="Theme"
            value={MODE_LABEL[mode]}
            detail="System, Light, or Dark mode"
            onPress={() => router.push('/profile')}
          />
        </SettingsGroup>

        <View style={styles.signOutSection}>
          <PrimaryButton
            label="Sign Out"
            variant="danger"
            icon="close"
            onPress={() => void signOut()}
          />
        </View>

        <Text style={[styles.version, { color: colors.muted }]}>
          {'SplitMoney v' + (Constants.expoConfig?.version ?? '0.1.0') + '  ·  ' + runtime.environment}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  identityBody: {
    flex: 1,
    gap: 2,
  },
  signOutSection: {
    paddingTop: spacing.xs,
  },
  version: {
    fontSize: typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
