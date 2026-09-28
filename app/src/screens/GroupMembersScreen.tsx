import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { groups as groupsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { GroupMember } from '@/api/types';
import { useGroup } from '@/features/group/GroupContext';
import { canEditGroup } from '@/features/group/permissions';
import { useAuth } from '@/auth/AuthProvider';
import {
  SMActionSheet,
  SMAvatar,
  SMBadge,
  SMConfirmSheet,
  SMScreenHeader,
  SMSettingsGroup,
  SMSettingsRow,
  type SMAction,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

/**
 * Who is in the group.
 *
 * Everyone can open a member to see what stands between the two of them. Only the group's
 * creator is offered "Remove", and never on their own row — the server refuses that, and
 * leaving is a separate action. Removal is also refused while the member still has
 * unsettled balances; that rule is the server's, and its message is shown as-is rather
 * than guessed at here.
 *
 * The member stays on screen until the server confirms they are gone; the list is then
 * re-read, so the count here and everywhere else agrees.
 */
export default function GroupMembersScreen() {
  const { colors } = useTheme();
  const { groupId, detail, refresh } = useGroup();
  const { user } = useAuth();
  const router = useRouter();

  const [menuFor, setMenuFor] = useState<GroupMember | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<GroupMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const members = detail?.members ?? [];
  const editable = canEditGroup(detail?.group);

  const back = (): void => (router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never));

  const remove = async (member: GroupMember): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setRemoveError(null);
    try {
      await groupsApi.removeMember(groupId, member.id);
      setConfirmRemove(null);
      await refresh();
    } catch (caught: unknown) {
      // Kept in the sheet that asked, and the member stays listed.
      setRemoveError(describeError(caught).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const actionsFor = (member: GroupMember): SMAction[] => [
    {
      id: 'view',
      label: 'View balance with ' + member.fullName.split(' ')[0],
      description: 'What stands between the two of you',
      icon: 'balance',
      onPress: () => router.push(('/group/' + groupId + '/person/' + member.id) as never),
    },
    ...(editable && member.id !== user?.id
      ? [
          {
            id: 'remove',
            label: 'Remove from group',
            icon: 'trash' as const,
            destructive: true,
            onPress: () => {
              setRemoveError(null);
              setConfirmRemove(member);
            },
          },
        ]
      : []),
  ];

  const standing = (member: GroupMember): string =>
    member.netPaise === 0
      ? 'All square'
      : member.netPaise > 0
        ? 'Is owed ' + formatPaise(member.netPaise, { compact: true })
        : 'Owes ' + formatPaise(Math.abs(member.netPaise), { compact: true });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader
        title="Members"
        subtitle={members.length === 1 ? '1 member' : members.length + ' members'}
        onBack={back}
        action={{
          icon: 'userPlus',
          label: 'Invite people',
          onPress: () => router.push(('/group/' + groupId + '/settings') as never),
        }}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <SMSettingsGroup footer="Amounts are each person’s overall position in the group, from the server.">
          {members.map((member) => {
            const isMe = member.id === user?.id;
            return (
              <SMSettingsRow
                key={member.id}
                title={isMe ? member.fullName + ' (you)' : member.fullName}
                subtitle={standing(member)}
                leading={<SMAvatar name={member.fullName} size={36} round />}
                trailing={
                  member.role === 'creator' ? <SMBadge label="Creator" tone="neutral" /> : undefined
                }
                onPress={() => setMenuFor(member)}
              />
            );
          })}
        </SMSettingsGroup>

        {!editable ? (
          <Text style={[styles.note, { color: colors.muted }]}>
            Only the group’s creator can remove members.
          </Text>
        ) : null}
      </ScrollView>

      <SMActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.fullName ?? ''}
        {...(menuFor ? { subtitle: standing(menuFor) } : {})}
        actions={menuFor ? actionsFor(menuFor) : []}
      />

      <SMConfirmSheet
        visible={confirmRemove !== null}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) void remove(confirmRemove);
        }}
        destructive
        loading={busy}
        icon="trash"
        title={'Remove ' + (confirmRemove?.fullName ?? 'this member') + '?'}
        description="They’ll lose access to this group. Someone in the group can invite them back."
        detail="A member with unsettled balances can’t be removed until those are settled."
        errorMessage={removeError}
        confirmLabel="Remove"
        cancelLabel="Keep them"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.md, paddingBottom: spacing.xxl },
  note: { fontSize: typography.caption, textAlign: 'center' },
});
