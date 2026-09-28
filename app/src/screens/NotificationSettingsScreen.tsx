import { useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { devices as devicesApi, groups as groupsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import { CHANNELS } from '@/notifications/channels';
import type { NotificationPreferences } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useNotifications } from '@/notifications/NotificationProvider';
import {
  SMButton,
  SMCard,
  SMErrorState,
  SMInlineNotice,
  SMRowSkeleton,
  SMScreenHeader,
  SMToggleRow,
} from '@/components/sm';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

type CategoryKey = 'settlements' | 'financial' | 'activity' | 'security';

/**
 * The categories that actually control something.
 *
 * Each maps to the server's NOTIFICATION_CATEGORY (expoPushService). `general` is left out
 * on purpose: the preference exists, but no notification type is filed under it, so a
 * toggle for it would switch nothing. The descriptions name only the notifications that
 * really exist in each category.
 */
const CATEGORIES: { key: CategoryKey; label: string; description: string; icon: IconName; tag?: string }[] = [
  {
    key: 'settlements',
    label: 'Payments',
    description: 'When someone asks you to confirm a payment, confirms or rejects yours, or sends a reminder.',
    icon: 'settlement',
  },
  {
    key: 'financial',
    label: 'Expenses',
    description: 'When an expense you share is added, edited or deleted.',
    icon: 'expense',
  },
  {
    key: 'activity',
    label: 'New members',
    description: 'When someone joins one of your groups.',
    icon: 'userPlus',
  },
  {
    key: 'security',
    label: 'Security alerts',
    description: 'A new device signing in, a password change, or a session ended.',
    icon: 'shield',
    tag: 'Recommended',
  },
];

/**
 * Which notifications reach this phone as a push.
 *
 * WHAT THESE SWITCHES DO — AND DON'T. They decide what is PUSHED. Every notification is
 * still recorded in the in-app inbox whatever is set here (the server checks these only
 * before sending a push), and the copy says so rather than implying a switch hides things.
 *
 * EACH SWITCH SAVES AS IT IS FLIPPED — there is no Save button, because the server stores
 * each change on its own. The switch moves at once; if the server refuses, it moves back to
 * what the server holds and the row says what went wrong.
 *
 * No quiet hours and no digest here: the backend has neither, and a control for something
 * that does not exist would be a promise the app cannot keep.
 */
export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { push, permission, enablePush } = useNotifications();

  const [saving, setSaving] = useState<keyof NotificationPreferences | null>(null);
  const [failed, setFailed] = useState<{ key: keyof NotificationPreferences; message: string } | null>(null);
  const [local, setLocal] = useState<NotificationPreferences | null>(null);
  const [testing, setTesting] = useState(false);

  const request = useRequest<{ preferences: NotificationPreferences }>(
    useCallback((signal: AbortSignal) => devicesApi.preferences(signal), []),
    [],
  );

  const preferences = local ?? request.data?.preferences ?? null;

  const update = async (key: keyof NotificationPreferences, next: boolean): Promise<void> => {
    if (!preferences || saving) return;

    const before = preferences;
    setLocal({ ...preferences, [key]: next });
    setSaving(key);
    setFailed(null);

    try {
      const { preferences: saved } = await devicesApi.savePreferences({ [key]: next });
      setLocal(saved);
    } catch (caught: unknown) {
      // Back to what the server actually holds, and say why.
      setLocal(before);
      setFailed({ key, message: 'Couldn’t save that change. ' + describeError(caught).message });
    } finally {
      setSaving(null);
    }
  };

  // Development-only: fires a local notification through the real deep-link router.
  const sendTest = async (): Promise<void> => {
    if (testing) return;
    setTesting(true);
    try {
      const { groups } = await groupsApi.list();
      const group = groups[0];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'SplitMoney test notification',
          body: group ? 'Tap to open ' + group.name + '.' : 'Tap to open SplitMoney.',
          data: group ? { type: 'expense_added', groupId: group.id } : { type: 'expense_added' },
          ...(Platform.OS === 'android' ? { channelId: CHANNELS.financial } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
      });
    } finally {
      setTesting(false);
    }
  };

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/settings' as never));

  /* ---- This phone's state, in words a person can act on ---- */
  const device = (() => {
    if (permission.granted && push.status === 'registered') {
      return {
        icon: 'checkCircle' as IconName,
        tone: colors.success,
        title: 'Notifications are on for this phone',
        body: 'Choose below which ones arrive as a push.',
        action: null,
      };
    }
    if (permission.granted && push.status === 'unsupported') {
      return {
        icon: 'info' as IconName,
        tone: colors.warning,
        title: 'Push isn’t available in this version of the app',
        body: 'You’ll still see every notification in the app’s inbox.',
        action: null,
      };
    }
    if (!permission.granted && !permission.canAskAgain) {
      return {
        icon: 'bell' as IconName,
        tone: colors.muted,
        title: 'Notifications are turned off',
        body: 'They were switched off in your phone’s settings. You’ll still see everything in the app’s inbox.',
        action: { label: 'Open phone settings', onPress: () => void Linking.openSettings() },
      };
    }
    return {
      icon: 'bell' as IconName,
      tone: colors.primary,
      title: 'Get notified on this phone',
      body: 'Payments waiting for you, new expenses and security alerts, without opening the app.',
      action: {
        label: push.status === 'requesting' ? 'Asking…' : push.status === 'error' ? 'Try again' : 'Turn on notifications',
        onPress: () => void enablePush(),
      },
    };
  })();

  const pushOn = Boolean(preferences?.pushEnabled);
  const deviceReady = permission.granted;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Notification settings" onBack={back} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* ---- This phone ---- */}
        <SMCard style={styles.device}>
          <View style={styles.deviceHead}>
            <Icon name={device.icon} size={18} color={device.tone} />
            <Text style={[styles.deviceTitle, { color: colors.text }]}>{device.title}</Text>
          </View>
          <Text style={[styles.deviceBody, { color: colors.muted }]}>{device.body}</Text>
          {push.status === 'error' || push.status === 'unsupported' ? (
            __DEV__ && push.detail ? (
              <Text selectable style={[styles.devDetail, { color: colors.muted }]}>
                {push.detail}
              </Text>
            ) : null
          ) : null}
          {device.action ? (
            <SMButton
              label={device.action.label}
              variant={permission.canAskAgain ? 'primary' : 'secondary'}
              loading={push.status === 'requesting'}
              onPress={device.action.onPress}
            />
          ) : null}
        </SMCard>

        {request.loading && !request.data ? (
          <SMRowSkeleton rows={4} bordered={false} />
        ) : request.error && !request.data ? (
          <SMErrorState error={request.error} onRetry={() => void request.refresh()} />
        ) : preferences ? (
          <>
            <Section title="Push">
              <SMCard style={styles.group}>
                <SMToggleRow
                  label="Push notifications"
                  description={
                    deviceReady
                      ? 'Send notifications to this phone. Your inbox keeps everything either way.'
                      : 'Turn on notifications for this phone first.'
                  }
                  icon="bell"
                  value={pushOn}
                  onChange={(next) => void update('pushEnabled', next)}
                  saving={saving === 'pushEnabled'}
                  disabled={!deviceReady}
                  {...(failed?.key === 'pushEnabled' ? { error: failed.message } : {})}
                />
              </SMCard>
            </Section>

            <Section title="What to push">
              <SMCard style={styles.group}>
                {CATEGORIES.map((category, index) => (
                  <View
                    key={category.key}
                    style={index > 0 ? [styles.divided, { borderTopColor: colors.border }] : null}
                  >
                    <SMToggleRow
                      label={category.label}
                      description={category.description}
                      icon={category.icon}
                      value={preferences[category.key]}
                      onChange={(next) => void update(category.key, next)}
                      saving={saving === category.key}
                      // Meaningless while push itself is off; shown, but not operable.
                      disabled={!pushOn || !deviceReady}
                      {...(category.tag ? { tag: category.tag } : {})}
                      {...(failed?.key === category.key ? { error: failed.message } : {})}
                    />
                  </View>
                ))}
              </SMCard>
              {!pushOn ? (
                <SMInlineNotice type="info" message="Turn on push notifications to choose which ones you get." />
              ) : null}
            </Section>
          </>
        ) : null}

        {__DEV__ ? (
          <Section title="Development">
            <SMButton
              label="Send a test notification in 5 seconds"
              variant="secondary"
              icon="send"
              loading={testing}
              onPress={() => void sendTest()}
            />
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  device: { padding: spacing.base, gap: spacing.sm },
  deviceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deviceTitle: { flex: 1, fontSize: typography.bodySm, fontWeight: '800' },
  deviceBody: { fontSize: typography.caption, lineHeight: 18 },
  devDetail: { fontSize: typography.xs },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  group: { paddingHorizontal: spacing.base },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
});
