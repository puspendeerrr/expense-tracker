import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { admin } from '@/api/endpoints';
import { useRequest } from '@/hooks/useRequest';
import {
  SMCard,
  SMErrorState,
  SMRowSkeleton,
  SMScreenHeader,
  SMSettingsGroup,
  SMSettingsRow,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

/**
 * The admin console's front page: the platform's numbers, and the ways in.
 *
 * Every figure is the server's (GET /admin/stats) and shown as sent — nothing is added up
 * on the phone. The console only reads: there are no buttons here that change anything.
 */
export default function AdminOverviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data, error, loading, refreshing, refresh } = useRequest((signal) => admin.stats(signal));

  const back = (): void => (router.canGoBack() ? router.back() : router.replace('/home'));
  const go = (path: string) => () => router.push(path as never);
  const n = (value: number): string => value.toLocaleString();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Admin console" subtitle="SplitMoney platform" onBack={back} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <SMRowSkeleton rows={4} />
        ) : error && !data ? (
          <SMErrorState error={error} onRetry={() => void refresh()} />
        ) : data ? (
          <View style={styles.grid}>
            <Stat
              label="Users"
              value={n(data.users.total)}
              lines={[
                n(data.users.newLast30Days) + ' new in 30 days',
                n(data.users.verified) + ' verified · ' + n(data.users.admins) + ' admins',
                n(data.users.disabled) + ' disabled',
              ]}
            />
            <Stat
              label="Groups"
              value={n(data.groups.total)}
              lines={[n(data.groups.active30Days) + ' active in 30 days', n(data.groups.disabled) + ' disabled']}
            />
            <Stat
              label="Expenses"
              value={n(data.expenses.total)}
              lines={[formatPaise(data.expenses.totalValuePaise) + ' recorded', n(data.expenses.last30Days) + ' in 30 days']}
            />
            <Stat
              label="Settlements"
              value={n(data.settlements.total)}
              lines={[
                n(data.settlements.completed) + ' completed · ' + n(data.settlements.pending) + ' waiting',
                formatPaise(data.settlements.completedValuePaise) + ' settled',
              ]}
            />
          </View>
        ) : null}

        <SMSettingsGroup title="Find">
          <SMSettingsRow icon="search" title="Search everything" subtitle="Users, groups and expenses" onPress={go('/admin/search')} />
        </SMSettingsGroup>

        <SMSettingsGroup title="Browse" footer="Read-only. Changes to accounts and groups are made from the web console.">
          <SMSettingsRow icon="users" title="Users" subtitle="Accounts, status and activity" onPress={go('/admin/users')} />
          <SMSettingsRow icon="group" title="Groups" subtitle="Members, spending and open debts" onPress={go('/admin/groups')} />
          <SMSettingsRow icon="expense" title="Expenses" subtitle="Across every group" onPress={go('/admin/expenses')} />
          <SMSettingsRow icon="settlement" title="Settlements" subtitle="Payments between members" onPress={go('/admin/settlements')} />
          <SMSettingsRow icon="activity" title="Activity" subtitle="What members are doing, newest first" onPress={go('/admin/activity')} />
          <SMSettingsRow icon="shield" title="Audit log" subtitle="Every admin action, newest first" onPress={go('/admin/audit')} />
        </SMSettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, lines }: { label: string; value: string; lines: string[] }) {
  const { colors } = useTheme();
  return (
    <SMCard style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      {lines.map((line) => (
        <Text key={line} style={[styles.statLine, { color: colors.muted }]}>
          {line}
        </Text>
      ))}
    </SMCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexBasis: '47%', flexGrow: 1, padding: spacing.md, gap: 2 },
  statLabel: { fontSize: typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: typography.title, fontWeight: '800', fontVariant: ['tabular-nums'], marginBottom: spacing.xs },
  statLine: { fontSize: typography.xs, lineHeight: 16 },
});
