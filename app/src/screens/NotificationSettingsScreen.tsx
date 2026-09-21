import { useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devices as devicesApi, groups as groupsApi } from '@/api/endpoints';
import { CHANNELS } from '@/notifications/channels';
import type { NotificationPreferences } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useNotifications } from '@/notifications/NotificationProvider';
import { ScreenHeader, SettingsGroup, SettingsRow } from '@/components/ScreenHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Card, CardSkeleton } from '@/components/ui';
import { ErrorState } from '@/components/StateViews';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

const CATEGORIES: { key: keyof NotificationPreferences; label: string; detail: string }[] = [
  {
    key: 'settlements',
    label: 'Settlements',
    detail: 'Payment requests, confirmations, rejections and reminders.',
  },
  {
    key: 'financial',
    label: 'Expenses',
    detail: 'Expenses added, edited or deleted in your groups.',
  },
  {
    key: 'activity',
    label: 'Group Activity',
    detail: 'Members joining or leaving, group settings updates.',
  },
  {
    key: 'security',
    label: 'Security Alerts',
    detail: 'New sign-ins and password updates (always kept in-app even if push is disabled).',
  },
  { key: 'general', label: 'General Updates', detail: 'System updates and reminders.' },
];

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const { push, permission, enablePush } = useNotifications();

  const [saving, setSaving] = useState<string | null>(null);
  const [local, setLocal] = useState<NotificationPreferences | null>(null);
  const [testing, setTesting] = useState(false);

  const sendTest = async (): Promise<void> => {
    if (testing) return;
    setTesting(true);
    try {
      const { groups } = await groupsApi.list();
      const group = groups[0];

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'SplitMoney Test Notification',
          body: group
            ? 'Tap to open ' + group.name + '. Delivered via deep-link router.'
            : 'Tap to open SplitMoney.',
          data: group ? { type: 'expense_added', groupId: group.id } : { type: 'expense_added' },
          ...(Platform.OS === 'android' ? { channelId: CHANNELS.financial } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
        },
      });
    } finally {
      setTesting(false);
    }
  };

  const request = useRequest<{ preferences: NotificationPreferences }>(
    useCallback((signal: AbortSignal) => devicesApi.preferences(signal), []),
    [],
  );

  const preferences = local ?? request.data?.preferences ?? null;

  const update = async (key: keyof NotificationPreferences, next: boolean): Promise<void> => {
    if (!preferences || saving) return;

    const optimistic = { ...preferences, [key]: next };
    setLocal(optimistic);
    setSaving(key);

    try {
      const { preferences: saved } = await devicesApi.savePreferences({ [key]: next });
      setLocal(saved);
    } catch {
      setLocal(preferences);
    } finally {
      setSaving(null);
    }
  };

  const permissionBlock = (): React.ReactElement => {
    if (permission.granted && push.status === 'registered') {
      return (
        <SettingsGroup title="Device Status">
          <SettingsRow label="Push Notifications" detail="Active on this device." value="Active" />
        </SettingsGroup>
      );
    }

    if (permission.granted && push.status === 'unsupported') {
      return (
        <SettingsGroup title="Device Status">
          <Card style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
              <Icon name="alert-circle" size={18} tone="warning" />
              <Text style={{ color: colors.warning, fontSize: typography.bodySm, fontWeight: '700' }}>
                Push tokens not available in this build
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
              Android notification permission is granted, but remote push requires an FCM credential. All notifications are still delivered inside the in-app notification centre.
            </Text>
            {push.detail ? (
              <Text selectable style={{ color: colors.muted, fontSize: typography.xs }}>
                {push.detail}
              </Text>
            ) : null}
          </Card>
        </SettingsGroup>
      );
    }

    if (!permission.granted && !permission.canAskAgain) {
      return (
        <SettingsGroup title="Device Status">
          <Card style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
              <Icon name="alert-circle" size={18} tone="muted" />
              <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                Notifications are disabled
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
              Permission has been declined in Android system settings. To enable push alerts, update your permissions in Android settings.
            </Text>
            <PrimaryButton
              label="Open Android Settings"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          </Card>
        </SettingsGroup>
      );
    }

    return (
      <SettingsGroup title="Device Status">
        <Card style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Icon name="bell" size={18} tone="primary" />
            <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
              Stay up to date
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
            Enable push notifications to be alerted when members add expenses, request settlements, or make account changes.
          </Text>
          {push.status === 'error' && push.detail ? (
            <Text style={{ color: colors.destructive, fontSize: typography.caption }}>
              {push.detail}
            </Text>
          ) : null}
          <PrimaryButton
            label={
              push.status === 'requesting'
                ? 'Requesting…'
                : push.status === 'error'
                  ? 'Retry Permission'
                  : 'Enable Push Notifications'
            }
            loading={push.status === 'requesting'}
            onPress={() => void enablePush()}
          />
        </Card>
      </SettingsGroup>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Notification Settings" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {permissionBlock()}

        {request.loading && !request.data ? (
          <CardSkeleton rows={4} />
        ) : request.error && !request.data ? (
          <ErrorState error={request.error} onRetry={() => void request.refresh()} />
        ) : preferences ? (
          <>
            <SettingsGroup title="Master Switch">
              <SettingsRow
                label="Allow Push Notifications"
                detail="Toggle push alerts to all your registered devices."
                disabled={!permission.granted || saving !== null}
                toggle={{
                  value: preferences.pushEnabled,
                  onChange: (next) => void update('pushEnabled', next),
                }}
              />
            </SettingsGroup>

            <SettingsGroup title="Notification Categories">
              {CATEGORIES.map((category) => (
                <SettingsRow
                  key={category.key}
                  label={category.label}
                  detail={category.detail}
                  disabled={!permission.granted || !preferences.pushEnabled || saving !== null}
                  toggle={{
                    value: Boolean(preferences[category.key]),
                    onChange: (next) => void update(category.key, next),
                  }}
                />
              ))}
            </SettingsGroup>

            {__DEV__ ? (
              <SettingsGroup title="Developer Testing">
                <Card style={styles.noticeCard}>
                  <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
                    Schedules a test notification in 5 seconds to verify background handling and deep linking.
                  </Text>
                  <PrimaryButton
                    label={testing ? 'Scheduling…' : 'Trigger Test Notification'}
                    variant="secondary"
                    loading={testing}
                    disabled={!permission.granted}
                    onPress={() => void sendTest()}
                  />
                </Card>
              </SettingsGroup>
            ) : null}

            <Text style={[styles.footnote, { color: colors.muted }]}>
              Disabled categories are suppressed directly at the server level, conserving battery and data.
            </Text>
          </>
        ) : null}
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
  noticeCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footnote: {
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
});
