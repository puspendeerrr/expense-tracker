import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { groups as groupsApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { GroupMember } from '@/api/types';
import { useGroup } from '@/features/group/GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Sheet } from '@/components/Sheet';
import { Avatar, Badge, Card } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

/**
 * Manage group membership, view individual balances, and invite new members.
 */
export default function GroupMembersScreen() {
  const { colors } = useTheme();
  const { groupId, detail, refresh } = useGroup();
  const { user } = useAuth();
  const router = useRouter();

  const [menuFor, setMenuFor] = useState<GroupMember | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<GroupMember | null>(null);
  const [busy, setBusy] = useState(false);

  const inFlight = useRef(false);

  const members = detail?.members ?? [];
  const isCreator = detail?.group.role === 'creator';

  const remove = async (member: GroupMember): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await groupsApi.removeMember(groupId, member.id);
      setConfirmRemove(null);
      setMenuFor(null);
      await refresh();
    } catch (caught: unknown) {
      setConfirmRemove(null);
      Alert.alert('Could not remove member', describeError(caught).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Group Members"
        subtitle={members.length === 1 ? '1 member' : members.length + ' members'}
        right={
          <PrimaryButton
            label="Invite"
            icon="add"
            variant="secondary"
            onPress={() => router.push(('/group/' + groupId + '/settings') as never)}
            style={styles.headerButton}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {members.map((member) => {
          const isMe = member.id === user?.id;
          const net = member.netPaise;

          return (
            <Card key={member.id}>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'View ' + member.fullName}
                  onPress={() => router.push(('/group/' + groupId + '/person/' + member.id) as never)}
                  style={styles.identity}
                >
                  <Avatar name={member.fullName} size={48} />
                  <View style={styles.identityText}>
                    <View style={styles.nameRow}>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}
                      >
                        {member.fullName}
                      </Text>
                      {isMe ? <Badge label="You" tone="info" /> : null}
                      {member.role === 'creator' ? <Badge label="Creator" /> : null}
                    </View>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
                      {member.email}
                    </Text>
                    <Text
                      style={{
                        color: net > 0 ? colors.success : net < 0 ? colors.destructive : colors.muted,
                        fontSize: typography.caption,
                        fontWeight: '600',
                      }}
                    >
                      {net === 0
                        ? 'Settled up in group'
                        : net > 0
                          ? 'Is owed ' + formatPaise(Math.abs(net), { compact: true })
                          : 'Owes ' + formatPaise(Math.abs(net), { compact: true })}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'Actions for ' + member.fullName}
                  onPress={() => setMenuFor(member)}
                  hitSlop={12}
                  style={styles.menuButton}
                >
                  <Icon name="more" size={20} tone="muted" />
                </Pressable>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Member Options Sheet */}
      <Sheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.fullName ?? 'Member'}
        subtitle={menuFor?.email}
      >
        <PrimaryButton
          label="View Balance & Expenses"
          icon="balance"
          variant="secondary"
          onPress={() => {
            const target = menuFor;
            setMenuFor(null);
            if (target) router.push(('/group/' + groupId + '/person/' + target.id) as never);
          }}
        />

        {menuFor && menuFor.id !== user?.id && menuFor.netPaise !== 0 ? (
          <PrimaryButton
            label="Settle Up With Them"
            icon="settlement"
            variant="secondary"
            onPress={() => {
              const target = menuFor;
              setMenuFor(null);
              if (target) router.push(('/group/' + groupId + '/settle?to=' + target.id) as never);
            }}
          />
        ) : null}

        {isCreator && menuFor && menuFor.id !== user?.id ? (
          <PrimaryButton
            label="Remove from Group"
            icon="trash"
            variant="danger"
            onPress={() => {
              setConfirmRemove(menuFor);
              setMenuFor(null);
            }}
          />
        ) : null}
      </Sheet>

      {/* Removal Confirmation Sheet */}
      <Sheet
        visible={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={'Remove ' + (confirmRemove?.fullName ?? 'Member') + '?'}
        footer={
          <>
            <PrimaryButton
              label="Confirm Removal"
              variant="danger"
              loading={busy}
              onPress={() => (confirmRemove ? void remove(confirmRemove) : undefined)}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setConfirmRemove(null)} />
          </>
        }
      >
        <Text style={{ color: colors.muted, fontSize: typography.bodySm, lineHeight: 22 }}>
          {confirmRemove && confirmRemove.netPaise !== 0
            ? confirmRemove.fullName +
              ' still has ' +
              formatPaise(Math.abs(confirmRemove.netPaise), { compact: true }) +
              ' outstanding in this group. The server will reject removal until that balance is settled.'
            : 'They will lose access to this group. Existing expenses they participated in will remain unchanged in the ledger.'}
        </Text>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerButton: {
    minHeight: 34,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
