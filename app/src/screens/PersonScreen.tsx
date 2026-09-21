import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  expenses as expensesApi,
  groups as groupsApi,
  settlements as settlementsApi,
} from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { ExpenseListPayload, Outstanding, SettlementListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '@/features/group/GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { SettlementCard } from '@/features/group/cards';
import { Avatar, Badge, Card, CardSkeleton, SectionHeader } from '@/components/ui';
import { ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatExpenseDate, formatPaise } from '@/lib/money';

/**
 * "Why do I owe Rahul ₹1,850?"
 *
 * Reconciles pairwise balance between viewer and another member.
 * The figures come from the authoritative balance engine on the backend; this screen
 * explains the balance by itemizing the contributing expenses and recorded settlements.
 */
export default function PersonScreen() {
  const { colors } = useTheme();
  const { groupId, refresh } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [reminding, setReminding] = useState(false);

  const person = lookup(userId);
  const isMe = userId === user?.id;

  const outstanding = useRequest<Outstanding>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.outstanding(groupId, userId, signal),
      [groupId, userId],
    ),
    [groupId, userId],
  );

  /** What they paid for that I share in: gross side of what I owe them */
  const theirExpenses = useRequest<ExpenseListPayload>(
    useCallback(
      (signal: AbortSignal) =>
        expensesApi.list(
          groupId,
          { paidBy: userId, involvement: 'paid_by_others_for_me', limit: 50 },
          signal,
        ),
      [groupId, userId],
    ),
    [groupId, userId],
  );

  /** Payments between the two of us in either direction */
  const history = useRequest<SettlementListPayload>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.list(groupId, { limit: 50 }, signal),
      [groupId],
    ),
    [groupId, userId],
  );

  const back = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  const iOwe = outstanding.data?.iOwePaise ?? 0;
  const theyOwe = outstanding.data?.theyOwePaise ?? 0;

  const contributing = theirExpenses.data?.expenses ?? [];
  const shownGross = contributing.reduce((total, e) => total + (e.mySharePaise ?? 0), 0);

  const between = (history.data?.settlements ?? []).filter(
    (s) =>
      (s.payerId === userId && s.receiverId === user?.id) ||
      (s.payerId === user?.id && s.receiverId === userId),
  );
  const settledToThem = between
    .filter((s) => s.status === 'completed' && s.payerId === user?.id)
    .reduce((total, s) => total + s.amountPaise, 0);

  const remind = async (): Promise<void> => {
    if (reminding) return;
    setReminding(true);
    try {
      await groupsApi.remind(groupId, userId);
      Alert.alert('Reminder sent', person.fullName + ' has been notified.');
    } catch (caught: unknown) {
      Alert.alert('Could not send reminder', describeError(caught).message);
    } finally {
      setReminding(false);
    }
  };

  const loading = outstanding.loading && !outstanding.data;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={10} style={styles.backButton}>
          <Icon name="back" size={20} tone="primary" />
        </Pressable>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '800' }}
        >
          {person.fullName}
        </Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.body}>
          <CardSkeleton rows={5} />
        </View>
      ) : outstanding.error && !outstanding.data ? (
        <ErrorState error={outstanding.error} onRetry={() => void outstanding.refresh()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity & Position Card */}
          <Card style={styles.heroCard}>
            <View style={styles.identity}>
              <Avatar name={person.fullName} size={56} />
              <View style={styles.identityBody}>
                <View style={styles.nameRow}>
                  <Text style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '800' }}>
                    {isMe ? 'You' : person.fullName}
                  </Text>
                  {isMe ? <Badge label="This is you" tone="info" /> : null}
                </View>
                {person.email ? (
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
                    {person.email}
                  </Text>
                ) : null}
              </View>
            </View>

            {isMe ? (
              <Text style={{ color: colors.muted, fontSize: typography.bodySm, lineHeight: 20 }}>
                This is your own profile in this group. Your overall position is summarized on the Balances tab.
              </Text>
            ) : iOwe === 0 && theyOwe === 0 ? (
              <View style={[styles.settledBanner, { backgroundColor: colors.primarySubtle }]}>
                <Icon name="check" size={18} tone="primary" />
                <Text style={{ color: colors.primary, fontSize: typography.bodySm, fontWeight: '700' }}>
                  You and {person.fullName} are all settled up!
                </Text>
              </View>
            ) : (
              <View style={styles.positionsRow}>
                {iOwe > 0 ? (
                  <View style={[styles.positionTile, { backgroundColor: colors.destructiveSubtle, borderColor: colors.destructive }]}>
                    <Text style={{ color: colors.destructive, fontSize: typography.xs, fontWeight: '700', textTransform: 'uppercase' }}>
                      You owe them
                    </Text>
                    <Text style={{ color: colors.destructive, fontSize: typography.heroSm, fontWeight: '900' }}>
                      {formatPaise(iOwe, { compact: true })}
                    </Text>
                  </View>
                ) : null}

                {theyOwe > 0 ? (
                  <View style={[styles.positionTile, { backgroundColor: colors.primarySubtle, borderColor: colors.primary }]}>
                    <Text style={{ color: colors.primary, fontSize: typography.xs, fontWeight: '700', textTransform: 'uppercase' }}>
                      Owes you
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: typography.heroSm, fontWeight: '900' }}>
                      {formatPaise(theyOwe, { compact: true })}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {!isMe && iOwe > 0 && theyOwe > 0 ? (
              <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
                Both debts stand separately according to SplitMoney ledger rules and are settled independently.
              </Text>
            ) : null}
          </Card>

          {/* Action Buttons */}
          {!isMe && (iOwe > 0 || theyOwe > 0) ? (
            <View style={styles.actions}>
              {iOwe > 0 ? (
                <PrimaryButton
                  label={'Settle Up ' + formatPaise(iOwe, { compact: true })}
                  icon="check"
                  onPress={() =>
                    router.push(('/group/' + groupId + '/settle?to=' + userId) as never)
                  }
                />
              ) : null}
              {theyOwe > 0 ? (
                <PrimaryButton
                  label={reminding ? 'Sending reminder…' : 'Send a Payment Reminder'}
                  variant="secondary"
                  icon="bell"
                  loading={reminding}
                  onPress={() => void remind()}
                />
              ) : null}
            </View>
          ) : null}

          {/* Why you owe explanation */}
          {!isMe && (iOwe > 0 || contributing.length > 0) ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title={'Why You Owe ' + person.fullName} />

              {theirExpenses.loading && !theirExpenses.data ? (
                <CardSkeleton rows={3} />
              ) : contributing.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    No expenses paid by them are currently outstanding against you.
                  </Text>
                </Card>
              ) : (
                <>
                  {contributing.map((expense) => (
                    <Card
                      key={expense.id}
                      onPress={() =>
                        router.push(('/group/' + groupId + '/expense/' + expense.id) as never)
                      }
                      accessibilityLabel={
                        expense.title +
                        ', your share ' +
                        formatPaise(expense.mySharePaise ?? 0, { compact: true })
                      }
                    >
                      <View style={styles.row}>
                        <View style={[styles.expenseIconCircle, { backgroundColor: colors.subtle }]}>
                          <Icon name="tag" size={16} tone="primary" />
                        </View>
                        <View style={styles.rowBody}>
                          <Text
                            numberOfLines={1}
                            style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}
                          >
                            {expense.title}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                            {formatExpenseDate(expense.expenseDate) +
                              '  ·  Total ' +
                              formatPaise(expense.amountPaise, { compact: true })}
                          </Text>
                        </View>
                        <View style={styles.shareCol}>
                          <Text style={{ color: colors.destructive, fontSize: typography.bodySm, fontWeight: '800' }}>
                            {formatPaise(expense.mySharePaise ?? 0)}
                          </Text>
                          <Icon name="forward" size={14} tone="muted" />
                        </View>
                      </View>
                    </Card>
                  ))}

                  {/* Visual Ledger Reconciliation Box */}
                  <Card style={styles.mathCard}>
                    <SectionHeader title="Balance Calculation" />
                    <MathRow
                      label={'Your share of ' + contributing.length + ' expenses'}
                      value={formatPaise(shownGross)}
                    />
                    {settledToThem > 0 ? (
                      <MathRow
                        label="Already paid to them"
                        value={'− ' + formatPaise(settledToThem)}
                        tone={colors.success}
                      />
                    ) : null}
                    <View style={[styles.mathDivider, { backgroundColor: colors.border }]} />
                    <MathRow
                      label="Current Outstanding Debt"
                      value={formatPaise(iOwe)}
                      tone={colors.destructive}
                      strong
                    />
                  </Card>

                  {theirExpenses.data?.pagination.hasMore ? (
                    <Text style={{ color: colors.muted, fontSize: typography.caption, textAlign: 'center' }}>
                      Showing the 50 most recent expenses.
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* Payments between you */}
          {!isMe ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title="Payment History Between You" />
              {history.loading && !history.data ? (
                <CardSkeleton rows={2} />
              ) : between.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    No settlements recorded between you two yet.
                  </Text>
                </Card>
              ) : (
                between.map((settlement) => (
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
          ) : null}

          <PrimaryButton
            label="Refresh Data"
            variant="secondary"
            onPress={() => {
              void outstanding.refresh();
              void theirExpenses.refresh();
              void history.refresh();
              void refresh();
            }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MathRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.mathRow}>
      <Text style={{ color: colors.muted, fontSize: typography.bodySm, flex: 1 }}>{label}</Text>
      <Text
        style={{
          color: tone ?? colors.text,
          fontSize: strong ? typography.body : typography.bodySm,
          fontWeight: strong ? '900' : '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 36 },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityBody: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  positionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  positionTile: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  actions: {
    gap: spacing.sm,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  expenseIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  shareCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mathCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  mathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  mathDivider: {
    height: 1,
    marginVertical: spacing.xs,
  },
});
