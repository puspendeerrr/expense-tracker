import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { admin } from '@/api/endpoints';
import { useRequest } from '@/hooks/useRequest';
import {
  SMAvatar,
  SMBadge,
  SMCard,
  SMDetailRow,
  SMErrorState,
  SMGroupDetailSkeleton,
  SMScreenHeader,
  SMSettingsGroup,
  SMSettingsRow,
} from '@/components/sm';
import { shortDate, shortDateTime } from '@/features/admin/format';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

/**
 * One group, as the admin API describes it: members, totals and who owes whom.
 *
 * The debts are the balance engine's own pairs, listed as sent; the phone neither nets
 * nor totals them. The invite code is left out — it is a key to the group, not a fact
 * about it.
 */
export default function AdminGroupDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { groupId = '' } = useLocalSearchParams<{ groupId: string }>();
  const { data, error, loading, refreshing, refresh } = useRequest((signal) => admin.group(groupId, signal), [groupId]);

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/admin/groups' as never));
  const withGroup = (path: string) => () => router.push((path + '?groupId=' + encodeURIComponent(groupId)) as never);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title={data?.group.name ?? 'Group'} subtitle="Admin console" onBack={back} />
      {loading ? (
        <SMGroupDetailSkeleton />
      ) : error && !data ? (
        <SMErrorState error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          <SMCard style={styles.card}>
            <View style={styles.badges}>
              <SMBadge label={data.group.status === 'disabled' ? 'Disabled' : 'Active'} tone={data.group.status === 'disabled' ? 'danger' : 'success'} />
            </View>
            {data.group.description ? (
              <Text style={[styles.description, { color: colors.muted }]}>{data.group.description}</Text>
            ) : null}
            <SMDetailRow label="Creator" value={data.creator.fullName + '\n' + data.creator.email} />
            <SMDetailRow label="Created" value={shortDateTime(data.group.createdAt)} />
            <SMDetailRow label="Payday" value={data.group.payday ? 'Day ' + data.group.payday + ' of each month' : 'Not set'} />
            {data.group.status === 'disabled' && data.group.disabledAt ? (
              <SMDetailRow label="Disabled on" value={shortDateTime(data.group.disabledAt)} />
            ) : null}
          </SMCard>

          <SMCard style={styles.card}>
            <SMDetailRow label="Members" value={data.stats.memberCount.toLocaleString()} />
            <SMDetailRow label="Expenses" value={data.stats.expenseCount.toLocaleString() + ' · ' + formatPaise(data.stats.expenseValuePaise)} />
            <SMDetailRow label="Settlements" value={data.stats.settlementCount.toLocaleString() + ' · ' + formatPaise(data.stats.settledValuePaise) + ' settled'} />
            <SMDetailRow label="Waiting" value={data.stats.pendingSettlements.toLocaleString() + ' to confirm'} />
            <SMDetailRow label="Open debts" value={data.stats.openDebtCount.toLocaleString() + ' · ' + formatPaise(data.stats.openDebtValuePaise)} />
            <SMDetailRow label="Activity" value={data.stats.activityCount.toLocaleString() + ' entries'} />
          </SMCard>

          <SMSettingsGroup title={'Members (' + data.members.length + ')'}>
            {data.members.map((member) => (
              <SMSettingsRow
                key={member.id}
                title={member.fullName}
                subtitle={member.email + ' · joined ' + shortDate(member.joinedAt)}
                leading={<SMAvatar name={member.fullName} size={36} round />}
                trailing={
                  <View style={styles.badges}>
                    {member.role === 'creator' ? <SMBadge label="Creator" tone="neutral" /> : null}
                    {member.status === 'disabled' ? <SMBadge label="Disabled" tone="danger" /> : null}
                  </View>
                }
              />
            ))}
          </SMSettingsGroup>

          <SMSettingsGroup title="Who owes whom" footer="From the balance engine, each pair as the server keeps it.">
            {data.debts.length === 0 ? (
              <SMSettingsRow title="Everyone is settled up" icon="checkCircle" />
            ) : (
              data.debts.map((debt) => (
                <SMSettingsRow
                  key={debt.debtorId + '>' + debt.creditorId}
                  title={debt.debtorName + ' → ' + debt.creditorName}
                  value={formatPaise(debt.owedPaise)}
                />
              ))
            )}
          </SMSettingsGroup>

          <SMSettingsGroup title="Records">
            <SMSettingsRow icon="expense" title="Expenses in this group" onPress={withGroup('/admin/expenses')} />
            <SMSettingsRow icon="settlement" title="Settlements in this group" onPress={withGroup('/admin/settlements')} />
            <SMSettingsRow icon="activity" title="Activity in this group" onPress={withGroup('/admin/activity')} />
          </SMSettingsGroup>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  card: { padding: spacing.md, gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  description: { fontSize: typography.bodySm, lineHeight: 20 },
});
