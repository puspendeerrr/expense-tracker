import { useCallback, useRef, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { groups as groupsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { GroupShareInfo } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup } from '@/features/group/GroupContext';
import { ScreenHeader, SettingsGroup, SettingsRow } from '@/components/ScreenHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { Sheet } from '@/components/Sheet';
import { Card, CardSkeleton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

export default function GroupSettingsScreen() {
  const { colors } = useTheme();
  const { groupId, detail, live, refresh } = useGroup();
  const router = useRouter();

  const [sheet, setSheet] = useState<'rename' | 'leave' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const inFlight = useRef(false);

  const group = detail?.group;
  const isCreator = group?.role === 'creator';

  const share = useRequest<GroupShareInfo>(
    useCallback((signal: AbortSignal) => groupsApi.share(groupId, signal), [groupId]),
    [groupId],
  );

  const owe = live?.balances.youNeedToPayTotal.paise ?? 0;
  const owed = live?.balances.youWillReceiveTotal.paise ?? 0;
  const entangled = owe > 0 || owed > 0;

  const run = async (label: string, fn: () => Promise<unknown>): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (caught: unknown) {
      Alert.alert('Could not ' + label, describeError(caught).message);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const rename = async (): Promise<void> => {
    const ok = await run('save changes', () =>
      groupsApi.update(groupId, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : { description: null }),
      }),
    );
    if (ok) {
      setSheet(null);
      await refresh();
    }
  };

  const leave = async (): Promise<void> => {
    const ok = await run('leave group', () => groupsApi.leave(groupId));
    if (ok) {
      setSheet(null);
      router.replace('/home');
    }
  };

  const copyInvite = async (): Promise<void> => {
    const code = share.data?.inviteCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareInvite = async (): Promise<void> => {
    const code = share.data?.inviteCode;
    if (!code || !group) return;
    try {
      await Share.share({
        message:
          'Join "' + group.name + '" on SplitMoney.\n\nInvite code: ' + code +
          '\n\nOr open: splitmoney://join/' + code,
      });
    } catch {
      // User dismissed share dialog
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Group Settings" subtitle={group?.name} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* General Details */}
        <SettingsGroup title="General Information">
          <SettingsRow
            label="Group Name"
            value={group?.name}
            detail={isCreator ? 'Tap to edit name' : 'Managed by group creator'}
            disabled={!isCreator}
            {...(isCreator
              ? {
                  onPress: () => {
                    setName(group?.name ?? '');
                    setDescription(group?.description ?? '');
                    setSheet('rename');
                  },
                }
              : {})}
          />
          <SettingsRow
            label="Description"
            value={group?.description ? undefined : 'No description added'}
            detail={group?.description ?? undefined}
          />
          <SettingsRow label="Currency" value={group?.currency ?? 'INR (₹)'} />
          <SettingsRow
            label="Members"
            value={String(detail?.members.length ?? 0)}
            detail="View and manage member list"
            onPress={() => router.push(('/group/' + groupId + '/members') as never)}
          />
        </SettingsGroup>

        {/* Invite Section */}
        <SettingsGroup title="Invite Members">
          {share.loading && !share.data ? (
            <CardSkeleton rows={1} />
          ) : share.error && !share.data ? (
            <Card>
              <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                Could not retrieve invite code.
              </Text>
              <PrimaryButton
                label="Retry"
                variant="secondary"
                onPress={() => void share.refresh()}
                style={styles.smallButton}
              />
            </Card>
          ) : (
            <>
              <Card style={styles.inviteCard}>
                <Text style={{ color: colors.muted, fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.8 }}>
                  INVITE CODE
                </Text>
                <View style={styles.codeContainer}>
                  <Text
                    selectable
                    style={{ color: colors.text, fontSize: typography.heroSm, fontWeight: '900', letterSpacing: 3 }}
                  >
                    {share.data?.inviteCode ?? '—'}
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  <PrimaryButton
                    label={copied ? 'Copied' : 'Copy Code'}
                    icon={copied ? 'check' : 'copy'}
                    variant="secondary"
                    onPress={() => void copyInvite()}
                    style={styles.half}
                  />
                  <PrimaryButton
                    label="Share Invite"
                    icon="send"
                    onPress={() => void shareInvite()}
                    style={styles.half}
                  />
                </View>
              </Card>

              {isCreator ? (
                <SettingsRow
                  label="Regenerate Invite Code"
                  detail="Generates a new code. Existing invite links will immediately expire."
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      'Regenerate Invite Code?',
                      'Anyone with the existing code will no longer be able to join.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Regenerate',
                          style: 'destructive',
                          onPress: () =>
                            void run('regenerate invite', async () => {
                              await groupsApi.regenerateInvite(groupId);
                              await share.refresh();
                            }),
                        },
                      ],
                    )
                  }
                />
              ) : null}
            </>
          )}
        </SettingsGroup>

        {/* Danger Zone: Leaving Group */}
        <SettingsGroup title="Danger Zone">
          {entangled ? (
            <Card style={styles.warningCard}>
              <View style={styles.warningHeader}>
                <Icon name="alert-circle" size={18} tone="warning" />
                <Text style={{ color: colors.warning, fontSize: typography.bodySm, fontWeight: '700' }}>
                  Outstanding Balance
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
                {'You have unsettled balances in this group' +
                  (owe > 0 ? ' — you owe ' + formatPaise(owe, { compact: true }) : '') +
                  (owed > 0 ? (owe > 0 ? ', and ' : ' — ') + formatPaise(owed, { compact: true }) + ' is owed to you' : '') +
                  '. Settle all balances before leaving the group.'}
              </Text>
            </Card>
          ) : null}

          <SettingsRow
            label="Leave Group"
            detail="Remove yourself from this group and its ledger"
            destructive
            disabled={busy}
            onPress={() => setSheet('leave')}
          />
        </SettingsGroup>

        <Text style={[styles.note, { color: colors.muted }]}>
          Group ownership transfers must be performed via the SplitMoney administrative interface.
        </Text>
      </ScrollView>

      {/* Rename Sheet */}
      <Sheet
        visible={sheet === 'rename'}
        onClose={() => setSheet(null)}
        title="Rename Group"
        footer={
          <>
            <PrimaryButton
              label="Save Changes"
              loading={busy}
              disabled={name.trim().length === 0}
              onPress={() => void rename()}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setSheet(null)} />
          </>
        }
      >
        <TextField label="Group Name" value={name} onChangeText={setName} maxLength={80} autoFocus />
        <TextField
          label="Description (Optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What is this group for?"
          maxLength={300}
          multiline
          style={styles.multiline}
        />
      </Sheet>

      {/* Leave Sheet */}
      <Sheet
        visible={sheet === 'leave'}
        onClose={() => setSheet(null)}
        title={'Leave ' + (group?.name ?? 'Group') + '?'}
        footer={
          <>
            <PrimaryButton
              label="Confirm & Leave"
              variant="danger"
              loading={busy}
              onPress={() => void leave()}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setSheet(null)} />
          </>
        }
      >
        <Text style={{ color: colors.muted, fontSize: typography.bodySm, lineHeight: 22 }}>
          {entangled
            ? 'You still have money outstanding in this group. The server will refuse the request until all debts are settled.'
            : 'You will immediately lose access to this group, its expenses, and settlements.'}
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
  inviteCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  codeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  smallButton: {
    minHeight: 36,
    paddingVertical: spacing.xxs,
  },
  warningCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  note: {
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
});
