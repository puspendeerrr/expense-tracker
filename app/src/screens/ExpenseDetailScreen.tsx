import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { expenses as expensesApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { Expense } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '@/features/group/GroupContext';
import { canModifyExpense } from '@/features/group/permissions';
import { useAuth } from '@/auth/AuthProvider';

import {
  SMAvatar,
  SMBadge,
  SMButton,
  SMCard,
  SMConfirmSheet,
  SMDetailRow,
  SMErrorState,
  SMRowSkeleton,
  SMScreenHeader,
  SMSectionHeader,
  SMSheet,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { useAiScreenContext } from '@/ai/useAiScreenContext';
import {
  categoryLabel,
  formatExpenseDate,
  formatInstant,
  formatPaise,
  SPLIT_LABELS,
} from '@/lib/money';

export default function ExpenseDetailScreen() {
  const { colors, dark } = useTheme();
  const { groupId, refresh } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
  const router = useRouter();
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(false);

  const request = useRequest<{ expense: Expense }>(
    useCallback(
      (signal: AbortSignal) => expensesApi.get(groupId, expenseId, signal),
      [groupId, expenseId],
    ),
    [groupId, expenseId],
  );

  const expense = request.data?.expense;
  useAiScreenContext('expense', expense?.title);
  const back = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  const remove = async (): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await expensesApi.remove(groupId, expenseId);
      setConfirmDelete(false);
      void refresh();
      back();
    } catch (caught: unknown) {
      // The server owns this rule; its sentence stays in the sheet that asked.
      setDeleteError(describeError(caught).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SMScreenHeader title="Expense details" onBack={back} />

      {request.loading && !expense ? (
        <SMRowSkeleton rows={5} />
      ) : request.error && !expense ? (
        <SMErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : expense ? (
        <ScrollView contentContainerStyle={styles.body}>
          {/* ---- Headline Card ---- */}
          <SMCard>
            <View style={styles.headlineTop}>
              <SMBadge label={categoryLabel(expense.category)} />
              <SMBadge label={expense.paymentMode === 'upi' ? 'UPI' : 'Cash'} />
              <SMBadge label={SPLIT_LABELS[expense.splitType] ?? expense.splitType} />
            </View>

            <Text
              accessibilityRole="header"
              style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '700', marginTop: spacing.xs }}
            >
              {expense.title}
            </Text>

            <Text style={{ color: colors.text, fontSize: typography.hero, fontWeight: '800' }}>
              {formatPaise(expense.amountPaise)}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'View ' + (expense.payer?.fullName ?? 'the payer')}
              onPress={() =>
                router.push(('/group/' + groupId + '/person/' + expense.paidBy) as never)
              }
              style={[styles.payerRow, { backgroundColor: colors.subtle }]}
            >
              <SMAvatar name={expense.payer?.fullName ?? '?'} size={32} />
              <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '600', flex: 1 }}>
                {(expense.paidBy === user?.id ? 'You' : (expense.payer?.fullName ?? 'Someone')) +
                  ' paid ' +
                  formatPaise(expense.amountPaise, { compact: true })}
              </Text>
              <Icon name="forward" size={14} tone="muted" />
            </Pressable>
          </SMCard>

          {/* ---- Your Share Card ---- */}
          {expense.involvement !== 'not_involved' ? (
            <SMCard
              style={{
                backgroundColor:
                  expense.involvement === 'paid_by_me'
                    ? colors.successLight
                    : colors.destructiveLight,
                borderColor:
                  expense.involvement === 'paid_by_me'
                    ? colors.success
                    : colors.destructive,
              }}
            >
              <SMSectionHeader title="Your share" />
              <Text
                style={{
                  color: expense.involvement === 'paid_by_me' ? colors.success : colors.destructive,
                  fontSize: typography.heroSm,
                  fontWeight: '800',
                  marginVertical: spacing.xxs,
                }}
              >
                {formatPaise(expense.mySharePaise ?? 0)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
                {expense.involvement === 'paid_by_me'
                  ? 'You paid the full amount. ' +
                    formatPaise(expense.amountPaise - (expense.mySharePaise ?? 0), { compact: true }) +
                    ' is owed back to you by other members.'
                  : 'This is your share of this expense.'}
              </Text>
            </SMCard>
          ) : null}

          {/* ---- The Split Breakdown ---- */}
          <View style={styles.block}>
            <SMSectionHeader title={'Split breakdown (' + expense.participantCount + ' ways)'} />
            {expense.participants.map((participant) => {
              const person = lookup(participant.userId);
              const isMe = participant.userId === user?.id;
              return (
                <Pressable
                  key={participant.userId}
                  accessibilityRole="button"
                  accessibilityLabel={
                    person.fullName + ', ' + formatPaise(participant.sharePaise, { compact: true })
                  }
                  onPress={() =>
                    router.push(('/group/' + groupId + '/person/' + participant.userId) as never)
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                >
                  <SMCard>
                  <View style={styles.row}>
                    <SMAvatar name={person.fullName} size={36} />
                    <View style={styles.rowBody}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                          {isMe ? 'You' : person.fullName}
                        </Text>
                        {isMe ? <SMBadge label="You" tone="primary" /> : null}
                      </View>
                      {participant.splitValue !== null ? (
                        <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                          {expense.splitType === 'percentage'
                            ? participant.splitValue + '%'
                            : expense.splitType === 'shares'
                              ? participant.splitValue + (participant.splitValue === 1 ? ' share' : ' shares')
                              : 'entered directly'}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                      {formatPaise(participant.sharePaise)}
                    </Text>
                    <Icon name="forward" size={14} tone="muted" />
                  </View>
                  </SMCard>
                </Pressable>
              );
            })}
          </View>

          {/* ---- Metadata Details ---- */}
          <SMCard>
            <SMSectionHeader title="Expense details" />
            <SMDetailRow label="Expense date" value={formatExpenseDate(expense.expenseDate)} />
            <SMDetailRow label="Added on" value={formatInstant(expense.createdAt)} />
            {expense.updatedAt !== expense.createdAt ? (
              <SMDetailRow label="Last edited" value={formatInstant(expense.updatedAt)} />
            ) : null}
            {expense.notes ? <SMDetailRow label="Notes" value={expense.notes} /> : null}
          </SMCard>

          {/* ---- Attached Receipt ---- */}
          {expense.receiptUrl ? (
            <View style={styles.block}>
              <SMSectionHeader title="Attached receipt" />
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="View receipt full size"
                onPress={() => setViewReceipt(true)}
                style={[styles.receiptBox, !dark ? shadows.sm : null]}
              >
                <Image
                  source={{ uri: expense.receiptUrl }}
                  style={styles.receipt}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                <View style={styles.receiptOverlay}>
                  <Icon name="receipt" size={16} tone="onPrimary" />
                  <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '600' }}>
                    Tap to expand
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/*
            ---- Actions: rendered for the payer only ----

            Not disabled, not greyed — absent. A disabled Delete invites a tap to find out
            why, and the answer is always the same rule. Everyone else sees who paid, just
            above, which is the explanation.
          */}
          {canModifyExpense(expense, user?.id) ? (
            <View style={styles.actions}>
              <SMButton
                label="Edit expense"
                icon="edit"
                variant="secondary"
                onPress={() =>
                  router.push(('/group/' + groupId + '/expense/' + expense.id + '/edit') as never)
                }
                style={{ flex: 1 }}
              />
              <SMButton
                label="Delete"
                icon="trash"
                variant="danger"
                onPress={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                style={{ flex: 1 }}
                accessibilityHint="Asks for confirmation before deleting"
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {/* ---- Delete confirmation ---- */}
      <SMConfirmSheet
        visible={confirmDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
        onConfirm={() => void remove()}
        destructive
        loading={deleting}
        icon="trash"
        title="Delete this expense?"
        description={
          expense
            ? '“' + expense.title + '” for ' +
              formatPaise(expense.amountPaise, { compact: true }) +
              ' will be removed from this group for everyone.'
            : ''
        }
        detail="The expense is deleted outright, not archived, and this cannot be undone. Balances for everyone who shared it will be recalculated by the server."
        errorMessage={deleteError}
        confirmLabel="Delete expense"
      />

      {/* ---- Full receipt ---- */}
      <SMSheet visible={viewReceipt} onClose={() => setViewReceipt(false)} title="Attached receipt">
        {expense?.receiptUrl ? (
          <Image
            source={{ uri: expense.receiptUrl }}
            style={styles.receiptFull}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel="Receipt image"
          />
        ) : null}
      </SMSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.base, gap: spacing.base, paddingBottom: spacing.xxl },
  headlineTop: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  receiptBox: {
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  receipt: { width: '100%', height: 200 },
  receiptOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
  },
  receiptFull: { width: '100%', height: 440, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
