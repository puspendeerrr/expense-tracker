import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { security as securityApi } from '@/api/endpoints';
import type { AccountEvent, Pagination } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { ScreenHeader, SettingsGroup, SettingsRow } from '@/components/ScreenHeader';
import { Card, CardSkeleton } from '@/components/ui';
import { ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatInstant } from '@/lib/money';

const EVENT_LABEL: Record<string, string> = {
  login_succeeded: 'Successful Sign-in',
  login_failed: 'Failed Sign-in Attempt',
  new_device_detected: 'Sign-in from New Device',
  logout: 'Signed Out',
  password_changed: 'Password Changed',
  password_reset: 'Password Reset',
  session_revoked: 'Device Signed Out',
  sessions_revoked: 'All Other Devices Signed Out',
  email_verified: 'Email Verified',
  account_disabled: 'Account Disabled',
  account_enabled: 'Account Enabled',
};

const label = (type: string): string =>
  EVENT_LABEL[type] ?? type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const NOTABLE = new Set(['login_failed', 'new_device_detected', 'password_changed', 'password_reset']);

const PAGE = 25;

export default function SecurityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [limit, setLimit] = useState(PAGE);

  const history = useRequest<{ events: AccountEvent[]; pagination: Pagination }>(
    useCallback((signal: AbortSignal) => securityApi.events({ limit }, signal), [limit]),
    [limit],
  );

  const events = history.data?.events ?? [];
  const hasMore = history.data?.pagination.hasMore ?? false;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Account Security" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <SettingsGroup title="Safety & Access Controls">
          <SettingsRow
            label="Active Sessions & Devices"
            detail="Review and sign out other phones or browsers"
            onPress={() => router.push('/settings/devices')}
          />
          <SettingsRow
            label="Security Alert Preferences"
            detail="Configure push alerts for new logins"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsRow
            label="Change Password"
            detail="Manage credentials securely on the SplitMoney web portal"
            value="Web"
          />
        </SettingsGroup>

        <SettingsGroup title="Audit & Activity Log">
          {history.loading && !history.data ? (
            <CardSkeleton rows={4} />
          ) : history.error && !history.data ? (
            <ErrorState error={history.error} onRetry={() => void history.refresh()} />
          ) : events.length === 0 ? (
            <Card>
              <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                No security events logged yet.
              </Text>
            </Card>
          ) : (
            <>
              {events.map((event) => {
                const isWarning = NOTABLE.has(event.type);
                return (
                  <Card key={event.id}>
                    <View style={styles.eventRow}>
                      <View
                        style={[
                          styles.eventIconBadge,
                          { backgroundColor: isWarning ? colors.warningSubtle : colors.subtle },
                        ]}
                      >
                        <Icon
                          name={isWarning ? 'alert-circle' : 'shield'}
                          size={18}
                          tone={isWarning ? 'warning' : 'muted'}
                        />
                      </View>
                      <View style={styles.eventBody}>
                        <View style={styles.titleRow}>
                          <Text
                            style={{
                              color: isWarning ? colors.warning : colors.text,
                              fontSize: typography.bodySm,
                              fontWeight: '700',
                              flex: 1,
                            }}
                          >
                            {label(event.type)}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: typography.xs }}>
                            {formatInstant(event.createdAt)}
                          </Text>
                        </View>
                        <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                          {[event.device, event.ipAddress].filter(Boolean).join('  ·  ') || 'Unknown device'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}

              {hasMore ? (
                <PrimaryButton
                  label={history.refreshing ? 'Loading…' : 'Load More Log Entries'}
                  variant="secondary"
                  loading={history.refreshing}
                  onPress={() => setLimit((val) => val + PAGE)}
                />
              ) : null}
            </>
          )}
        </SettingsGroup>

        <Text style={[styles.footnote, { color: colors.muted }]}>
          If you detect unrecognized sign-in activity, revoke other active sessions immediately and update your password on SplitMoney web.
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
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  eventIconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  eventBody: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  footnote: {
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
});
