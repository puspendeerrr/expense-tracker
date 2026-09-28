import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { groups as groupsApi, settlements as settlementsApi } from '@/api/endpoints';
import type { AnalyticsRegion, SettlementListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '../GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { describeSettlement, settlementChips } from '../chips';
import { describeExpenseRow } from '../expenseRow';
import { ActivityRow } from './Activity';

import { Icon } from '@/components/Icon';
import {
  SMCard,
  SMEmptyState,
  SMErrorState,
  SMExpenseListItem,
  SMRowSkeleton,
  SMSectionHeader,
  SMSettlementListItem,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import {
  formatInstant,
  formatPaise,
} from '@/lib/money';
import type { GroupSection } from '../sections';

export function Overview({ onNavigate }: { onNavigate: (section: GroupSection) => void }) {
  const { colors } = useTheme();
  const { groupId, live, revision } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
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
      <SMCard style={styles.card}>
        <Eyebrow>Your position</Eyebrow>
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
      </SMCard>

      {/* ---- What the group has spent ---- */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Total group spending, open expenses"
        onPress={() => onNavigate('expenses')}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <SMCard style={styles.card}>
          <View style={styles.spendHead}>
            <Eyebrow>Total group spending</Eyebrow>
            <Icon name="forward" size={14} tone="muted" />
          </View>

          {analytics.loading && !analytics.data ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              <View style={[styles.ghostLine, { backgroundColor: colors.subtle, width: '46%', height: 24 }]} />
              <View style={[styles.ghostLine, { backgroundColor: colors.subtle, width: '68%' }]} />
            </View>
          ) : analytics.error && !analytics.data ? (
            <Text style={{ color: colors.muted, fontSize: typography.caption, marginTop: spacing.xs }}>
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
        </SMCard>
      </Pressable>

      {/* ---- Recent expenses ---- */}
      <View style={styles.block}>
        <SMSectionHeader
          title="Recent expenses"
          actionLabel="See all"
          onAction={() => onNavigate('expenses')}
        />

        {analytics.loading && !analytics.data ? (
          <SMRowSkeleton rows={3} />
        ) : analytics.error && !analytics.data ? (
          <SMErrorState error={analytics.error} onRetry={() => void analytics.refresh()} />
        ) : (analytics.data?.recentExpenses.length ?? 0) === 0 ? (
          <SMEmptyState
            icon="expense"
            title="No expenses yet"
            description="Add your first shared expense to start tracking what everyone spent."
            primaryAction={{
              label: 'Add expense',
              onPress: () => router.push(('/group/' + groupId + '/expense/new') as never),
            }}
          />
        ) : (
          analytics.data?.recentExpenses.slice(0, 3).map((expense) => (
            <SMExpenseListItem
              key={expense.id}
              {...describeExpenseRow(expense)}
              onPress={() => router.push(('/group/' + groupId + '/expense/' + expense.id) as never)}
            />
          ))
        )}
      </View>

      {/* ---- Recent settlements ---- */}
      <View style={styles.block}>
        <SMSectionHeader
          title="Recent settlements"
          actionLabel="See all"
          onAction={() => onNavigate('settlements')}
        />

        {recentSettlements.loading && !recentSettlements.data ? (
          <SMRowSkeleton rows={2} />
        ) : recentSettlements.error && !recentSettlements.data ? (
          <SMErrorState
            error={recentSettlements.error}
            onRetry={() => void recentSettlements.refresh()}
          />
        ) : (recentSettlements.data?.settlements.length ?? 0) === 0 ? (
          <SMEmptyState
            icon="settlement"
            title="No payments yet"
            description="When someone settles up, it will show here."
          />
        ) : (
          <View style={styles.rows}>
            {recentSettlements.data?.settlements.map((settlement) => {
              const described = describeSettlement(settlement, user?.id, (id) => lookup(id).fullName);

              return (
                <SMSettlementListItem
                  key={settlement.id}
                  title={described.title}
                  amount={formatPaise(settlement.amountPaise, { compact: true })}
                  dateLabel={formatInstant(settlement.paidAt)}
                  tone={described.tone}
                  chips={settlementChips(settlement)}
                  onPress={() =>
                    router.push(('/group/' + groupId + '/settlement/' + settlement.id) as never)
                  }
                />
              );
            })}
          </View>
        )}
      </View>

      {/* ---- Recent activity ---- */}
      <View style={styles.block}>
        <SMSectionHeader
          title="Recent activity"
          actionLabel="See all"
          onAction={() => onNavigate('activity')}
        />

        {recentActivity.loading && !recentActivity.data ? (
          <SMRowSkeleton rows={3} bordered={false} />
        ) : recentActivity.error && !recentActivity.data ? (
          <SMErrorState error={recentActivity.error} onRetry={() => void recentActivity.refresh()} />
        ) : (recentActivity.data?.activities.length ?? 0) === 0 ? (
          <SMEmptyState
            icon="activity"
            title="Nothing has happened yet"
            description="Adding an expense or settling up will show up here."
          />
        ) : (
          <SMCard style={styles.activityCard}>
            {recentActivity.data?.activities.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} groupId={groupId} />
            ))}
          </SMCard>
        )}
      </View>
    </View>
  );
}

/**
 * The small capitalised label above a card's headline number.
 *
 * Written as sentence case in the source and uppercased by the style, so a screen reader
 * says "Your position" rather than spelling it out letter by letter as it does with text
 * that is literally uppercase.
 */
function Eyebrow({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.eyebrow, { color: colors.muted }]}>{children}</Text>;
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
  card: { padding: spacing.base },
  rows: { gap: spacing.sm },
  eyebrow: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  spendHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ghostLine: { height: 12, borderRadius: radius.xs },
  // Activity rows are borderless, so one card holds the run of them together.
  activityCard: { padding: spacing.sm },
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
