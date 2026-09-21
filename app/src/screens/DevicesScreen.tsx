import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devices as devicesApi, security as securityApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { PushDevice, SessionDevice } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useAuth } from '@/auth/AuthProvider';
import { ScreenHeader, SettingsGroup, SettingsRow } from '@/components/ScreenHeader';
import { Badge, Card, CardSkeleton } from '@/components/ui';
import { ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatInstant } from '@/lib/money';

export default function DevicesScreen() {
  const { colors } = useTheme();
  const { signOut } = useAuth();

  const [renaming, setRenaming] = useState<SessionDevice | null>(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<'others' | SessionDevice | null>(null);
  const [busy, setBusy] = useState(false);

  const sessions = useRequest<{ devices: SessionDevice[] }>(
    useCallback((signal: AbortSignal) => securityApi.devices(signal), []),
    [],
  );

  const registered = useRequest<{ devices: PushDevice[] }>(
    useCallback((signal: AbortSignal) => devicesApi.list(signal), []),
    [],
  );

  const run = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await sessions.refresh();
      await registered.refresh();
      setConfirm(null);
      setRenaming(null);
    } catch (caught: unknown) {
      Alert.alert('Could not ' + label, describeError(caught).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (session: SessionDevice): Promise<void> => {
    await run('sign that out', async () => {
      const result = await securityApi.revoke(session.id);
      if (result.signedOut) await signOut();
    });
  };

  const rows = sessions.data?.devices ?? [];
  const phones = registered.data?.devices ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Devices & Sessions" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {sessions.loading && !sessions.data ? (
          <CardSkeleton rows={4} />
        ) : sessions.error && !sessions.data ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refresh()} />
        ) : (
          <SettingsGroup title={'Active Sessions (' + rows.length + ')'}>
            {rows.map((session) => (
              <Card key={session.id}>
                <View style={styles.sessionRow}>
                  <View style={[styles.deviceIconCircle, { backgroundColor: colors.subtle }]}>
                    <Icon name="smartphone" size={20} tone="primary" />
                  </View>
                  <View style={styles.sessionInfo}>
                    <View style={styles.nameRow}>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700', flex: 1 }}
                      >
                        {session.name ?? session.device}
                      </Text>
                      {session.isCurrent ? <Badge label="Current Device" tone="positive" /> : null}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                      {session.name ? session.device : 'Signed in ' + formatInstant(session.createdAt)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: typography.xs }}>
                      {'Last active ' +
                        formatInstant(session.lastUsedAt) +
                        (session.ipAddress ? '  ·  ' + session.ipAddress : '')}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <PrimaryButton
                    label="Rename"
                    variant="secondary"
                    icon="edit"
                    onPress={() => {
                      setRenaming(session);
                      setName(session.name ?? '');
                    }}
                    style={styles.smallButton}
                  />
                  <PrimaryButton
                    label={session.isCurrent ? 'Sign Out' : 'Sign Out Device'}
                    variant="danger"
                    icon="close"
                    onPress={() => setConfirm(session)}
                    style={styles.smallButton}
                  />
                </View>
              </Card>
            ))}

            {rows.filter((session) => !session.isCurrent).length > 0 ? (
              <PrimaryButton
                label="Sign Out All Other Devices"
                variant="danger"
                onPress={() => setConfirm('others')}
              />
            ) : null}
          </SettingsGroup>
        )}

        {phones.length > 0 ? (
          <SettingsGroup title="Phones Registered for Push">
            {phones.map((phone) => (
              <SettingsRow
                key={phone.id}
                label={phone.deviceName ?? 'Mobile Device'}
                detail={
                  phone.platform +
                  (phone.appVersion ? '  ·  v' + phone.appVersion : '') +
                  '  ·  Last active ' +
                  formatInstant(phone.lastActiveAt)
                }
              />
            ))}
          </SettingsGroup>
        ) : null}
      </ScrollView>

      {/* Rename Device Sheet */}
      <Sheet
        visible={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename Device"
        subtitle="Give this session a recognizable label."
        footer={
          <PrimaryButton
            label="Save Name"
            loading={busy}
            onPress={() =>
              renaming
                ? void run('rename device', () => securityApi.rename(renaming.id, name.trim()))
                : undefined
            }
          />
        }
      >
        <TextField
          label="Device Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. My Galaxy M34"
          maxLength={60}
        />
      </Sheet>

      {/* Confirm Revoke Sheet */}
      <Sheet
        visible={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === 'others'
            ? 'Sign out all other devices?'
            : confirm?.isCurrent
              ? 'Sign out of this device?'
              : 'Sign out this device?'
        }
        subtitle={
          confirm === 'others'
            ? 'Every session except this one will be immediately terminated.'
            : 'You will need to sign in again to access your groups.'
        }
        footer={
          <>
            <PrimaryButton
              label={confirm === 'others' ? 'Sign out others' : 'Confirm sign out'}
              variant="danger"
              loading={busy}
              onPress={() => {
                if (confirm === 'others') {
                  void run('sign out other devices', () => securityApi.revokeOthers());
                } else if (confirm) {
                  void revoke(confirm);
                }
              }}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setConfirm(null)} />
          </>
        }
      >
        <Text style={{ color: colors.muted, fontSize: typography.bodySm, lineHeight: 20 }}>
          Any ongoing offline changes on that device will no longer sync with your account.
        </Text>
      </Sheet>
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
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  deviceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  smallButton: {
    flex: 1,
    minHeight: 36,
    paddingVertical: spacing.xxs,
  },
});
