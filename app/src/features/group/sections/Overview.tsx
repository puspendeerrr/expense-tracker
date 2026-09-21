import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { groups as groupsApi, settlements as settlementsApi } from '@/api/endpoints';
import type { AnalyticsRegion, SettlementListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '../GroupContext';
import { SettlementCard } from '../cards';
import { ActivityRow } from './Activity';
import { Card, CardSkeleton, SectionHeader } from '@/components/ui';
import { ErrorState } from '@/components/StateViews';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { formatExpenseDate, formatPaise } from '@/lib/money';
import type { GroupSection } from '../sections';

export function Overview({ onNavigate }: { onNavigate: (section: GroupSection) => void }) {
  const { colors } = useTheme();
  const { groupId, live, revision } = useGroup();
  const lookup = useMemberLookup();
  const router = useRouter();

  const analytics = useRequest<AnalyticsRegion>(
    useCallback((signal: AbortSignal) => groupsApi.analytics(groupId, signal), [groupId]),
    [groupId, revision],
  );

  const recentSettlements = useRequest<SettlementListPayload>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.list(groupId, { limit: 3 }, signal),
      [groupId],
    ),
    [groupId, revision],
  );

  const recentActivity = useRequest(
    useCallback((signal: AbortSignal) => groupsApi.activities(groupId, { limit: 5 }, signal), [groupId]),
    [groupId, revision],
  );

  const balances = live?.balances;
  const net = balances?.netBalance.paise ?? 0;

  return (
    <View style={styles.container}>
      {/* ---- Where you stand Hero ---- */}
      <Card>
        <Text
          style={{
            color: colors.muted,
            fontSize: typography.xs,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          YOUR POSITION
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: net > 0 ? colors.success : net < 0 ? colors.destructive : colors.text,
            fontSize: typography.hero,
            fontWeight: '800',
            marginVertical: spacing.xxs,
          }}
        >
          {formatPaise(Math.abs(net), { compact: true })}
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '500' }}>
          {net > 0
            ? 'You are owed overall in this group'
            : net < 0
              ? 'You owe overall in this group'
              : 'You are all square in this group'}
        </Text>

        <View style={styles.split}>
          <BalanceTile
            label="You owe"
            amountPaise={balances?.youNeedToPayTotal.paise ?? 0}
            count={balances?.peopleIOweCount ?? 0}
            tone={colors.destructive}
            bg={colors.destructiveLight}
            onPress={() => onNavigate('balances')}
          />
          <BalanceTile
            label="Owed to you"
            amountPaise={balances?.youWillReceiveTotal.paise ?? 0}
            count={balances?.peopleWhoOweMeCount ?? 0}
            tone={colors.success}
            bg={colors.successLight}
            onPress={() => onNavigate('balances')}
          />
        </View>
      </Card>

      {/* ---- What the group has spent ---- */}
      <Card onPress={() => onNavigate('expenses')} accessibilityLabel="Total group spending, open expenses">
        <SectionHeader title="Total Group Spending" />
        {analytics.loading && !analytics.data ? (
          <Text style={{ color: colors.muted, fontSize: typography.bodySm }}>Loading…</Text>
        ) : analytics.error && !analytics.data ? (
          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
            Could not load spending just now.
          </Text>
        ) : (
          <View style={{ gap: spacing.xxs, marginTop: spacing.xs }}>
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              {formatPaise(analytics.data?.periodSummary.totalExpense.paise ?? 0, { compact: true })}
            </Text>
            <Text style={{ color: colors.muted, fontSize: typography.caption }}>
              {(analytics.data?.periodSummary.expenseCount ?? 0) +
                ' expenses · your share ' +
                formatPaise(analytics.data?.periodSummary.myShare.paise ?? 0, { compact: true })}
            </Text>
          </View>
        )}
      </Card>

      {/* ---- Recent expenses ---- */}
      <View style={styles.block}>
        <SectionHeader
          title="Recent Expenses"
          action={
            <Pressable accessibilityRole="button" onPress={() => onNavigate('expenses')} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
                See All
              </Text>
            </Pressable>
          }
        />

        {analytics.loading && !analytics.data ? (
          <CardSkeleton rows={2} />
        ) : analytics.error && !analytics.data ? (
          <ErrorState error={analytics.error} onRetry={() => void analytics.refresh()} />
        ) : (analytics.data?.recentExpenses.length ?? 0) === 0 ? (
          <Card>
            <Text style={{ color: colors.muted, fontSize: typography.caption, textAlign: 'center', paddingVertical: spacing.sm }}>
              No expenses in this group yet.
            </Text>
          </Card>
        ) : (
          analytics.data?.recentExpenses.slice(0, 3).map((expense) => (
            <Card
              key={expense.id}
              onPress={() => router.push(('/group/' + groupId + '/expense/' + expense.id) as never)}
              accessibilityLabel={expense.title + ', ' + formatPaise(expense.amountPaise, { compact: true })}
            >
              <View style={styles.row}>
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                    {expense.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
                    {expense.payerName + ' · ' + formatExpenseDate(expense.expenseDate)}
                  </Text>
                </View>
                <View style={styles.amountRight}>
                  <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                    {formatPaise(expense.amountPaise, { compact: true })}
                  </Text>
                  <Icon name="forward" size={14} tone="muted" />
                </View>
              </View>
            </Card>
          ))
        )}
      </View>

      {/* ---- Recent settlements ---- */}
      <View style={styles.block}>
        <SectionHeader
          title="Recent Settlements"
          action={
            <Pressable accessibilityRole="button" onPress={() => onNavigate('settlements')} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
                See All
              </Text>
            </Pressable>
          }
        />

        {recentSettlements.loading && !recentSettlements.data ? (
          <CardSkeleton rows={2} />
        ) : (recentSettlements.data?.settlements.length ?? 0) === 0 ? (
          <Card>
            <Text style={{ color: colors.muted, fontSize: typography.caption, textAlign: 'center', paddingVertical: spacing.sm }}>
              No payments recorded yet.
            </Text>
          </Card>
        ) : (
          recentSettlements.data?.settlements.map((settlement) => (
            <SettlementCard
              key={settlement.id}
              settlement={settlement}
              payerName={lookup(settlement.payerId).fullName}
              receiverName={lookup(settlement.receiverId).fullName}
              onPress={() =>
                router.push(('/group/' + groupId + '/settlement/' + settlement.id) as never)
              }
            />
          ))
        )}
      </View>

      {/* ---- Recent activity ---- */}
      <View style={styles.block}>
        <SectionHeader
          title="Recent Activity"
          action={
            <Pressable accessibilityRole="button" onPress={() => onNavigate('activity')} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
                See All
              </Text>
            </Pressable>
          }
        />

        {recentActivity.loading && !recentActivity.data ? (
          <CardSkeleton rows={3} />
        ) : (recentActivity.data?.activities.length ?? 0) === 0 ? (
          <Card>
            <Text style={{ color: colors.muted, fontSize: typography.caption, textAlign: 'center', paddingVertical: spacing.sm }}>
              No activity recorded yet.
            </Text>
          </Card>
        ) : (
          recentActivity.data?.activities.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} groupId={groupId} />
          ))
        )}
      </View>
    </View>
  );
}

function BalanceTile({
  label,
  amountPaise,
  count,
  tone,
  bg,
  onPress,
}: {
  label: string;
  amountPaise: number;
  count: number;
  tone: string;
  bg: string;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label + ' ' + formatPaise(amountPaise, { compact: true }) + ', ' + count + ' people. Opens balances.'
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: bg,
          borderColor: tone,
          opacity: pressed ? 0.85 : 1,
        },
        !dark ? shadows.sm : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.muted, fontSize: typography.caption, fontWeight: '600' }}>{label}</Text>
        <Icon name="forward" size={14} tone="muted" />
      </View>
      <Text style={{ color: tone, fontSize: typography.heroSm, fontWeight: '800', marginVertical: 2 }}>
        {formatPaise(amountPaise, { compact: true })}
      </Text>
      <Text style={{ color: colors.muted, fontSize: typography.xs }}>
        {count === 1 ? '1 person' : `${count} people`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.base },
  block: { gap: spacing.sm },
  split: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: {
    flex: 1,
    minHeight: 96,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  amountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
