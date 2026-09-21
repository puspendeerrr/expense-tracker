import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGroup } from '../GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, Badge, Card, SectionHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

export function MembersSection() {
  const { colors } = useTheme();
  const { groupId, detail } = useGroup();
  const { user } = useAuth();
  const router = useRouter();

  const members = detail?.members ?? [];

  return (
    <View style={styles.container}>
      <SectionHeader
        title={`Group Members (${members.length})`}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage members"
            onPress={() => router.push(('/group/' + groupId + '/members') as never)}
            hitSlop={8}
            style={styles.manageBtn}
          >
            <Icon name="settings" size={14} tone="primary" />
            <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
              Manage
            </Text>
          </Pressable>
        }
      />

      {members.map((member) => {
        const isMe = member.id === user?.id;
        const net = member.netPaise;

        return (
          <Card
            key={member.id}
            onPress={() => router.push(('/group/' + groupId + '/person/' + member.id) as never)}
            accessibilityLabel={
              member.fullName +
              (isMe ? ', you' : '') +
              ', ' +
              (net > 0 ? 'is owed ' : net < 0 ? 'owes ' : 'square, ') +
              (net === 0 ? '' : formatPaise(Math.abs(net), { compact: true }))
            }
          >
            <View style={styles.row}>
              <Avatar name={member.fullName} size={44} />

              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}
                  >
                    {member.fullName}
                  </Text>
                  {isMe ? <Badge label="You" tone="info" /> : null}
                  {member.role === 'creator' ? <Badge label="Owner" tone="positive" /> : null}
                </View>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
                  {member.email}
                </Text>
              </View>

              <View style={styles.amount}>
                <Text
                  style={{
                    color: net > 0 ? colors.success : net < 0 ? colors.destructive : colors.muted,
                    fontSize: typography.bodySm,
                    fontWeight: '800',
                  }}
                >
                  {net === 0 ? 'Settled' : formatPaise(Math.abs(net), { compact: true })}
                </Text>
                <Text style={{ color: colors.muted, fontSize: typography.xs }}>
                  {net > 0 ? 'owed' : net < 0 ? 'owes' : 'in group'}
                </Text>
              </View>

              <Icon name="forward" size={14} tone="muted" />
            </View>
          </Card>
        );
      })}

      <View style={[styles.noteBox, { backgroundColor: colors.subtle }]}>
        <Icon name="info" size={14} tone="muted" />
        <Text style={[styles.note, { color: colors.muted }]}>
          These balances represent each person&apos;s overall net balance in the group. Tap a member to see pairwise breakdown.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.sm },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xxs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  amount: { alignItems: 'flex-end', gap: spacing.xxs },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  note: { fontSize: typography.xs, lineHeight: 16, flex: 1 },
});
