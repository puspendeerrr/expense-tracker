import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/auth/AuthProvider';
import { useNotifications } from '@/notifications/NotificationProvider';
import { runtime } from '@/constants/environment';
import {
  SMAvatar,
  SMChipFilter,
  SMConfirmSheet,
  SMScreenHeader,
  SMSettingsGroup,
  SMSettingsRow,
} from '@/components/sm';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * The account's control centre.
 *
 * Every row leads somewhere that exists; nothing is shown disabled "for later". Identity
 * (name, UPI, QR) belongs to Profile and is only linked from here, and notification
 * switches live on their own screen — this hub shows a one-word summary and goes there.
 *
 * There is no "Delete account" row because the backend has no route for it. An admin can
 * deactivate an account, but that is not something the account holder can do themselves.
 */
export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, signOut } = useAuth();
  const { push, permission } = useNotifications();
  const router = useRouter();

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/home'));

  // A summary only from state the app actually knows — permission and registration.
  const notificationSummary = permission.granted
    ? push.status === 'registered'
      ? 'On'
      : push.status === 'unsupported'
        ? 'In-app only'
        : 'Setting up'
    : permission.canAskAgain
      ? 'Off'
      : 'Blocked';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Settings" onBack={back} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <SMSettingsGroup title="Account">
          <SMSettingsRow
            title={user?.fullName ?? 'Profile'}
            subtitle="Name, UPI ID and payment QR"
            leading={<SMAvatar name={user?.fullName ?? '?'} size={32} round />}
            onPress={() => router.push('/profile')}
          />
          <SMSettingsRow
            title="Notifications"
            subtitle="What reaches this phone"
            icon="bell"
            value={notificationSummary}
            onPress={() => router.push('/settings/notifications')}
          />
        </SMSettingsGroup>

        <SMSettingsGroup title="Security">
          <SMSettingsRow
            title="Password & security"
            subtitle="Change your password, recent sign-ins"
            icon="shield"
            onPress={() => router.push('/settings/security')}
          />
          <SMSettingsRow
            title="Devices & sessions"
            subtitle="Where you’re signed in"
            icon="smartphone"
            onPress={() => router.push('/settings/devices')}
          />
        </SMSettingsGroup>

        <View style={styles.appearance}>
          <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.muted }]}>
            Appearance
          </Text>
          <SMChipFilter accessibilityLabel="Theme" options={THEMES} value={mode} onChange={setMode} />
        </View>

        <SMSettingsGroup title="About">
          <SMSettingsRow title="SplitMoney" icon="info" value={'Version ' + (Constants.expoConfig?.version ?? '—')} />
          {__DEV__ ? (
            <SMSettingsRow title="Environment (dev only)" icon="settings" value={runtime.environment} />
          ) : null}
        </SMSettingsGroup>

        <SMSettingsGroup>
          <SMSettingsRow
            title="Sign out"
            icon="signOut"
            destructive
            onPress={() => setConfirmSignOut(true)}
            accessibilityHint="Asks for confirmation first"
          />
        </SMSettingsGroup>
      </ScrollView>

      <SMConfirmSheet
        visible={confirmSignOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
            setConfirmSignOut(false);
          }
        }}
        loading={signingOut}
        icon="signOut"
        title="Sign out of SplitMoney?"
        description="You can sign back in anytime with your email and password. Your AI conversation on this phone will be cleared."
        confirmLabel="Sign out"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  appearance: { gap: spacing.sm },
  groupTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', paddingHorizontal: spacing.xs },
});
