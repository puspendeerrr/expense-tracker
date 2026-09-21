import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGroup } from '../GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { PersonBalanceCard } from '../cards';
import { Avatar, Badge, Card, SectionHeader } from '@/components/ui';
import { EmptyState } from '@/components/StateViews';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

export function BalancesSection() {
  const { colors } = useTheme();
  const { groupId, live, detail } = useGroup();
  const { user } = useAuth();
  const router = useRouter();

  const balances = live?.balances;
  const iOwe = live?.peopleIOwe ?? [];
  const oweMe = live?.peopleWhoOweMe ?? [];

  const settled = (detail?.members ?? []).filter(
    (member) =>
      member.id !== user?.id &&
      !iOwe.some((e) => e.user.id === member.id) &&
      !oweMe.some((e) => e.user.id === member.id),
  );

  const open = (userId: string): void => {
    router.push(('/group/' + groupId + '/person/' + userId) as never);
  };

  if (iOwe.length === 0 && oweMe.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="All square"
          message="Nobody in this group owes anything right now. All balances are settled."
          icon="check"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '600' }}>
              You owe
            </Text>
            <Text
              style={{
                color: colors.destructive,
                fontSize: typography.title,
                fontWeight: '800',
              }}
            >
              {formatPaise(balances?.youNeedToPayTotal.paise ?? 0, { compact: true })}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.total}>
            <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '600' }}>
              You are owed
            </Text>
            <Text
              style={{
                color: colors.success,
                fontSize: typography.title,
                fontWeight: '800',
              }}
            >
              {formatPaise(balances?.youWillReceiveTotal.paise ?? 0, { compact: true })}
            </Text>
          </View>
        </View>

        <View style={[styles.infoBanner, { backgroundColor: colors.subtle }]}>
          <Icon name="info" size={14} tone="primary" />
          <Text style={{ color: colors.muted, fontSize: typography.xs, lineHeight: 16, flex: 1 }}>
            Debts are directional and pairwise. They are never netted against each other.
          </Text>
        </View>
      </Card>

      {iOwe.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader title={`You Owe (${iOwe.length})`} />
          {iOwe.map((entry) => (
            <PersonBalanceCard
              key={'owe-' + entry.user.id}
              entry={entry}
              direction="i_owe"
              onPress={() => open(entry.user.id)}
            />
          ))}
        </View>
      ) : null}

      {oweMe.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader title={`Owed To You (${oweMe.length})`} />
          {oweMe.map((entry) => (
            <PersonBalanceCard
              key={'owed-' + entry.user.id}
              entry={entry}
              direction="they_owe"
              onPress={() => open(entry.user.id)}
            />
          ))}
        </View>
      ) : null}

      {settled.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader title={`Settled (${settled.length})`} />
          {settled.map((member) => (
            <Card
              key={member.id}
              onPress={() => open(member.id)}
              accessibilityLabel={member.fullName + ', settled'}
            >
              <View style={styles.settledRow}>
                <View style={styles.settledLeft}>
                  <Avatar name={member.fullName} size={36} />
                  <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '600' }}>
                    {member.fullName}
                  </Text>
                </View>
                <Badge label="Settled" tone="positive" />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.base },
  block: { gap: spacing.sm },
  totals: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  total: { flex: 1, gap: spacing.xxs },
  divider: { width: 1, height: 44 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  settledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settledLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
