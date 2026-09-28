import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { describeSettlement, settlementChips } from '@/features/group/chips';
import {
  SMAvatar,
  SMBadge,
  SMButton,
  SMCard,
  SMErrorState,
  SMExpenseListItem,
  SMInlineNotice,
  SMRowSkeleton,
  SMScreenHeader,
  SMSectionHeader,
  SMSettlementListItem,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { formatExpenseDate, formatInstant, formatPaise } from '@/lib/money';
import { useAiScreenContext } from '@/ai/useAiScreenContext';

/**
 * PersonScreen
 *
 * "Why do I owe Rahul ₹1,850?"
 *
 * Reconciles the pairwise and directional financial relationship between the
 * viewer and another group member.
 *
 * FINANCIAL INTEGRITY INVARIANT:
 * All balance numbers come directly from the backend authoritative balance engine.
 * The client NEVER nets, rounds, or calculates balance amounts.
 * Both directions ("You owe them" and "They owe you") are reported and settled independently.
 */
export default function PersonScreen() {
  const { colors, dark } = useTheme();
  const { groupId, detail, refresh: refreshGroup } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [reminding, setReminding] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const person = lookup(userId);
  // Only once the member list has this person, so the label is never a placeholder name.
  useAiScreenContext('person', detail?.members.find((member) => member.id === userId)?.fullName);
  const isMe = userId === user?.id;

  /** Authoritative pairwise debt in both directions directly from the backend engine */
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

  /** What I paid for that they share in: gross side of what they owe me */
  const myExpensesForThem = useRequest<ExpenseListPayload>(
    useCallback(
      (signal: AbortSignal) => {
        if (!user?.id) {
          return Promise.resolve({
            expenses: [],
            pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
          });
        }
        return expensesApi.list(
          groupId,
          { paidBy: user.id, memberId: userId, limit: 50 },
          signal,
        );
      },
      [groupId, userId, user?.id],
    ),
    [groupId, userId, user?.id],
  );

  /** Payments between the two of us in either direction */
  const history = useRequest<SettlementListPayload>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.list(groupId, { limit: 50 }, signal),
      [groupId],
    ),
    [groupId, userId],
  );

  const back = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(('/group/' + groupId) as never);
    }
  };

  const iOwe = outstanding.data?.iOwePaise ?? 0;
  const theyOwe = outstanding.data?.theyOwePaise ?? 0;

  // Contributing expenses (they paid, I share)
  const contributing = theirExpenses.data?.expenses ?? [];
  const shownGross = contributing.reduce((total, e) => total + (e.mySharePaise ?? 0), 0);

  // My expenses for them (I paid, they share)
  const myContributing = (myExpensesForThem.data?.expenses ?? []).filter((e) =>
    e.participants.some((p) => p.userId === userId && p.sharePaise > 0),
  );
  const myShownGross = myContributing.reduce((total, e) => {
    const pShare = e.participants.find((p) => p.userId === userId)?.sharePaise ?? 0;
    return total + pShare;
  }, 0);

  // Settlement history between the two
  const between = (history.data?.settlements ?? []).filter(
    (s) =>
      (s.payerId === userId && s.receiverId === user?.id) ||
      (s.payerId === user?.id && s.receiverId === userId),
  );

  const settledToThem = between
    .filter((s) => s.status === 'completed' && s.payerId === user?.id)
    .reduce((total, s) => total + s.amountPaise, 0);

  const settledToMe = between
    .filter((s) => s.status === 'completed' && s.payerId === userId)
    .reduce((total, s) => total + s.amountPaise, 0);

  const remind = async (): Promise<void> => {
    if (reminding) return;
    setReminding(true);
    setNotice(null);
    try {
      await groupsApi.remind(groupId, userId);
      setNotice({
        type: 'success',
        message: `${person.fullName} has been sent a payment reminder.`,
      });
    } catch (caught: unknown) {
      setNotice({
        type: 'error',
        message: describeError(caught).message,
      });
    } finally {
      setReminding(false);
    }
  };

  const refreshAll = (): void => {
    void outstanding.refresh();
    void theirExpenses.refresh();
    void myExpensesForThem.refresh();
    void history.refresh();
    void refreshGroup();
  };

  const loading = outstanding.loading && !outstanding.data;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Screen Header */}
      <SMScreenHeader
        title={isMe ? 'You' : person.fullName}
        subtitle={detail?.group.name ? detail.group.name : 'Group balance'}
        variant="back"
        onBack={back}
      />

      {loading ? (
        <View style={styles.body}>
          <SMRowSkeleton rows={5} />
        </View>
      ) : outstanding.error && !outstanding.data ? (
        <SMErrorState error={outstanding.error} onRetry={refreshAll} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Inline Feedback Notice */}
          {notice ? (
            <SMInlineNotice
              type={notice.type}
              message={notice.message}
            />
          ) : null}

          {/* Identity & Authoritative Position Hero Card */}
          <SMCard style={styles.heroCard}>
            <View style={styles.identity}>
              <SMAvatar name={person.fullName} size={54} round />
              <View style={styles.identityBody}>
                <View style={styles.nameRow}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: typography.body,
                      fontWeight: '800',
                      letterSpacing: -0.2,
                    }}
                  >
                    {isMe ? 'You' : person.fullName}
                  </Text>
                  {isMe ? <SMBadge label="This is you" tone="info" /> : null}
                </View>
                {person.email ? (
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.muted, fontSize: typography.caption }}
                  >
                    {person.email}
                  </Text>
                ) : null}
              </View>
            </View>

            {isMe ? (
              <View style={[styles.infoBanner, { backgroundColor: colors.subtle }]}>
                <Icon name="info" size={16} tone="primary" />
                <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18, flex: 1 }}>
                  This is your own profile in this group. Your total balances across all members are
                  summarized on the Balances tab.
                </Text>
              </View>
            ) : iOwe === 0 && theyOwe === 0 ? (
              <View
                style={[
                  styles.settledBanner,
                  {
                    backgroundColor: dark ? '#064E3B44' : '#ECFDF5',
                    borderColor: dark ? '#065F46' : '#A7F3D0',
                  },
                ]}
              >
                <Icon name="check" size={20} tone="primary" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      color: dark ? '#6EE7B7' : '#047857',
                      fontSize: typography.bodySm,
                      fontWeight: '800',
                    }}
                  >
                    All settled up!
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: typography.xs }}>
                    You and {person.fullName} are all square. Neither owes the other anything.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.positionsRow}>
                {iOwe > 0 ? (
                  <View
                    style={[
                      styles.positionTile,
                      {
                        backgroundColor: dark ? '#450A0A55' : '#FEF2F2',
                        borderColor: dark ? '#991B1B' : '#FECACA',
                      },
                    ]}
                  >
                    <View style={styles.tileHeader}>
                      <View style={[styles.tileDot, { backgroundColor: colors.destructive }]} />
                      <Text
                        style={{
                          color: colors.destructive,
                          fontSize: typography.xs,
                          fontWeight: '700',
                          textTransform: 'uppercase',
                        }}
                      >
                        You owe them
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{
                        color: colors.destructive,
                        fontSize: typography.titleSm,
                        fontWeight: '900',
                      }}
                    >
                      {formatPaise(iOwe, { compact: true })}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: typography.xs }}>
                      Direct obligation
                    </Text>
                  </View>
                ) : null}

                {theyOwe > 0 ? (
                  <View
                    style={[
                      styles.positionTile,
                      {
                        backgroundColor: dark ? '#064E3B44' : '#ECFDF5',
                        borderColor: dark ? '#065F46' : '#A7F3D0',
                      },
                    ]}
                  >
                    <View style={styles.tileHeader}>
                      <View style={[styles.tileDot, { backgroundColor: colors.primary }]} />
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: typography.xs,
                          fontWeight: '700',
                          textTransform: 'uppercase',
                        }}
                      >
                        Owes you
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{
                        color: colors.primary,
                        fontSize: typography.titleSm,
                        fontWeight: '900',
                      }}
                    >
                      {formatPaise(theyOwe, { compact: true })}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: typography.xs }}>
                      Direct obligation
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {!isMe && iOwe > 0 && theyOwe > 0 ? (
              <View style={[styles.infoBanner, { backgroundColor: colors.subtle }]}>
                <Icon name="info" size={14} tone="primary" />
                <Text style={{ color: colors.muted, fontSize: typography.xs, lineHeight: 16, flex: 1 }}>
                  Both obligations stand separately according to SplitMoney ledger rules and are settled
                  independently without automatic netting.
                </Text>
              </View>
            ) : null}
          </SMCard>

          {/* Primary Action Buttons */}
          {!isMe && (iOwe > 0 || theyOwe > 0) ? (
            <View style={styles.actions}>
              {iOwe > 0 ? (
                <SMButton
                  label={'Settle Up ' + formatPaise(iOwe, { compact: true })}
                  icon="check"
                  onPress={() =>
                    router.push(('/group/' + groupId + '/settle?to=' + userId) as never)
                  }
                />
              ) : null}
              {theyOwe > 0 ? (
                <SMButton
                  label={reminding ? 'Sending reminder…' : 'Send Payment Reminder'}
                  variant={iOwe > 0 ? 'secondary' : 'primary'}
                  icon="bell"
                  loading={reminding}
                  onPress={() => void remind()}
                />
              ) : null}
            </View>
          ) : null}

          {/* Section: "Why You Owe [Name]" (Expenses paid by them that I share) */}
          {!isMe && (iOwe > 0 || contributing.length > 0) ? (
            <View style={styles.sectionBlock}>
              <SMSectionHeader title={'Why You Owe ' + person.fullName} />

              {theirExpenses.loading && !theirExpenses.data ? (
                <SMRowSkeleton rows={3} />
              ) : contributing.length === 0 ? (
                <SMCard>
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    No expenses paid by {person.fullName} are currently outstanding against you.
                  </Text>
                </SMCard>
              ) : (
                <>
                  <View style={styles.itemsList}>
                    {contributing.map((expense) => (
                      <SMExpenseListItem
                        key={expense.id}
                        title={expense.title}
                        amount={formatPaise(expense.amountPaise, { compact: true })}
                        payerLabel={person.fullName + ' paid'}
                        dateLabel={formatExpenseDate(expense.expenseDate)}
                        shareLabel={
                          'Your share ' + formatPaise(expense.mySharePaise ?? 0, { compact: true })
                        }
                        shareTone="owing"
                        categoryIcon="tag"
                        onPress={() =>
                          router.push(('/group/' + groupId + '/expense/' + expense.id) as never)
                        }
                      />
                    ))}
                  </View>

                  {/* Authoritative Ledger Breakdown Box */}
                  <SMCard style={styles.mathCard}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: typography.bodySm,
                        fontWeight: '700',
                        marginBottom: spacing.xs,
                      }}
                    >
                      Balance Reconciliation
                    </Text>
                    <MathRow
                      label={'Your share across ' + contributing.length + ' expenses'}
                      value={formatPaise(shownGross)}
                    />
                    {settledToThem > 0 ? (
                      <MathRow
                        label="Completed payments to them"
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
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: typography.xs,
                        marginTop: spacing.xxs,
                        lineHeight: 16,
                      }}
                    >
                      Authoritative debt figure computed by the SplitMoney balance engine.
                    </Text>
                  </SMCard>

                  {theirExpenses.data?.pagination.hasMore ? (
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: typography.caption,
                        textAlign: 'center',
                      }}
                    >
                      Showing the 50 most recent expenses.
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* Section: "Why [Name] Owes You" (Expenses paid by me that they share) */}
          {!isMe && (theyOwe > 0 || myContributing.length > 0) ? (
            <View style={styles.sectionBlock}>
              <SMSectionHeader title={'Why ' + person.fullName + ' Owes You'} />

              {myExpensesForThem.loading && !myExpensesForThem.data ? (
                <SMRowSkeleton rows={3} />
              ) : myContributing.length === 0 ? (
                <SMCard>
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    No expenses paid by you currently involve {person.fullName}.
                  </Text>
                </SMCard>
              ) : (
                <>
                  <View style={styles.itemsList}>
                    {myContributing.map((expense) => {
                      const counterpartShare =
                        expense.participants.find((p) => p.userId === userId)?.sharePaise ?? 0;
                      return (
                        <SMExpenseListItem
                          key={expense.id}
                          title={expense.title}
                          amount={formatPaise(expense.amountPaise, { compact: true })}
                          payerLabel="You paid"
                          dateLabel={formatExpenseDate(expense.expenseDate)}
                          shareLabel={
                            'Their share ' + formatPaise(counterpartShare, { compact: true })
                          }
                          shareTone="owed"
                          categoryIcon="tag"
                          onPress={() =>
                            router.push(('/group/' + groupId + '/expense/' + expense.id) as never)
                          }
                        />
                      );
                    })}
                  </View>

                  {/* Authoritative Ledger Breakdown Box for Owed */}
                  <SMCard style={styles.mathCard}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: typography.bodySm,
                        fontWeight: '700',
                        marginBottom: spacing.xs,
                      }}
                    >
                      Balance Reconciliation
                    </Text>
                    <MathRow
                      label={'Their share across ' + myContributing.length + ' expenses'}
                      value={formatPaise(myShownGross)}
                    />
                    {settledToMe > 0 ? (
                      <MathRow
                        label="Completed payments to you"
                        value={'− ' + formatPaise(settledToMe)}
                        tone={colors.success}
                      />
                    ) : null}
                    <View style={[styles.mathDivider, { backgroundColor: colors.border }]} />
                    <MathRow
                      label="Current Outstanding Owed"
                      value={formatPaise(theyOwe)}
                      tone={colors.primary}
                      strong
                    />
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: typography.xs,
                        marginTop: spacing.xxs,
                        lineHeight: 16,
                      }}
                    >
                      Authoritative owed figure computed by the SplitMoney balance engine.
                    </Text>
                  </SMCard>

                  {myExpensesForThem.data?.pagination.hasMore ? (
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: typography.caption,
                        textAlign: 'center',
                      }}
                    >
                      Showing the 50 most recent expenses.
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* Section: "Payment History Between You" */}
          {!isMe ? (
            <View style={styles.sectionBlock}>
              <SMSectionHeader title="Payment History Between You" />
              {history.loading && !history.data ? (
                <SMRowSkeleton rows={2} />
              ) : between.length === 0 ? (
                <SMCard>
                  <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                    No recorded settlements between you two yet.
                  </Text>
                </SMCard>
              ) : (
                <View style={styles.itemsList}>
                  {between.map((settlement) => {
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
                          router.push(
                            ('/group/' + groupId + '/settlement/' + settlement.id) as never,
                          )
                        }
                      />
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

          {/* Refresh Action */}
          <SMButton
            label="Refresh Breakdown"
            variant="secondary"
            icon="refresh"
            onPress={refreshAll}
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
          fontWeight: strong ? '800' : '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  body: {
    padding: spacing.base,
    gap: spacing.base,
    paddingBottom: spacing.xxl * 1.5,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    padding: spacing.base,
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
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
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
    gap: spacing.xxs,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tileDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  actions: {
    gap: spacing.sm,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  itemsList: {
    gap: spacing.sm,
  },
  mathCard: {
    padding: spacing.base,
    gap: spacing.xs,
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
