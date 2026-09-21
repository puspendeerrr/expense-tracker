import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { expenses as expensesApi } from '@/api/endpoints';
import { describeError } from '@/api/errors';
import type { Expense } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '@/features/group/GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, Badge, Card, CardSkeleton, DetailRow, SectionHeader } from '@/components/ui';
import { ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
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
  const back = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  const remove = async (): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    try {
      await expensesApi.remove(groupId, expenseId);
      setConfirmDelete(false);
      void refresh();
      back();
    } catch (caught: unknown) {
      setConfirmDelete(false);
      Alert.alert('Could not delete', describeError(caught).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Expense Details" onBack={back} />

      {request.loading && !expense ? (
        <CardSkeleton rows={5} />
      ) : request.error && !expense ? (
        <ErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : expense ? (
        <ScrollView contentContainerStyle={styles.body}>
          {/* ---- Headline Card ---- */}
          <Card>
            <View style={styles.headlineTop}>
              <Badge label={categoryLabel(expense.category)} />
              <Badge label={expense.paymentMode === 'upi' ? 'UPI' : 'Cash'} />
              <Badge label={SPLIT_LABELS[expense.splitType] ?? expense.splitType} />
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
              <Avatar name={expense.payer?.fullName ?? '?'} size={32} />
              <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '600', flex: 1 }}>
                {(expense.paidBy === user?.id ? 'You' : (expense.payer?.fullName ?? 'Someone')) +
                  ' paid ' +
                  formatPaise(expense.amountPaise, { compact: true })}
              </Text>
              <Icon name="forward" size={14} tone="muted" />
            </Pressable>
          </Card>

          {/* ---- Your Share Card ---- */}
          {expense.involvement !== 'not_involved' ? (
            <Card
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
              <SectionHeader title="Your Share" />
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
            </Card>
          ) : null}

          {/* ---- The Split Breakdown ---- */}
          <View style={styles.block}>
            <SectionHeader title={`Split Breakdown (${expense.participantCount} ways)`} />
            {expense.participants.map((participant) => {
              const person = lookup(participant.userId);
              const isMe = participant.userId === user?.id;
              return (
                <Card
                  key={participant.userId}
                  onPress={() =>
                    router.push(('/group/' + groupId + '/person/' + participant.userId) as never)
                  }
                  accessibilityLabel={
                    person.fullName + ', ' + formatPaise(participant.sharePaise, { compact: true })
                  }
                >
                  <View style={styles.row}>
                    <Avatar name={person.fullName} size={36} />
                    <View style={styles.rowBody}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                          {isMe ? 'You' : person.fullName}
                        </Text>
                        {isMe ? <Badge label="You" tone="info" /> : null}
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
                </Card>
              );
            })}
          </View>

          {/* ---- Metadata Details ---- */}
          <Card>
            <SectionHeader title="Expense Details" />
            <DetailRow label="Expense date" value={formatExpenseDate(expense.expenseDate)} />
            <DetailRow label="Added on" value={formatInstant(expense.createdAt)} />
            {expense.updatedAt !== expense.createdAt ? (
              <DetailRow label="Last edited" value={formatInstant(expense.updatedAt)} />
            ) : null}
            {expense.notes ? <DetailRow label="Notes" value={expense.notes} /> : null}
          </Card>

          {/* ---- Attached Receipt ---- */}
          {expense.receiptUrl ? (
            <View style={styles.block}>
              <SectionHeader title="Attached Receipt" />
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

          {/* ---- Actions ---- */}
          <View style={styles.actions}>
            <PrimaryButton
              label="Edit Expense"
              icon="edit"
              variant="secondary"
              onPress={() =>
                router.push(('/group/' + groupId + '/expense/' + expense.id + '/edit') as never)
              }
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Delete"
              icon="trash"
              variant="danger"
              onPress={() => setConfirmDelete(true)}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      ) : null}

      {/* Delete Confirmation Sheet */}
      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this expense?"
        subtitle="Everyone's balances in this group will be adjusted. This action cannot be undone."
        footer={
          <View style={{ gap: spacing.sm }}>
            <PrimaryButton
              label={deleting ? 'Deleting…' : 'Confirm Delete'}
              icon="trash"
              variant="danger"
              loading={deleting}
              onPress={() => void remove()}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setConfirmDelete(false)} />
          </View>
        }
      >
        <Text style={{ color: colors.muted, fontSize: typography.bodySm, lineHeight: 22, paddingVertical: spacing.xs }}>
          {expense
            ? `"${expense.title}" for ${formatPaise(expense.amountPaise, { compact: true })} will be permanently removed.`
            : ''}
        </Text>
      </Sheet>

      {/* Full Receipt Modal */}
      <Sheet visible={viewReceipt} onClose={() => setViewReceipt(false)} title="Attached Receipt">
        {expense?.receiptUrl ? (
          <Image
            source={{ uri: expense.receiptUrl }}
            style={styles.receiptFull}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel="Receipt image"
          />
        ) : null}
      </Sheet>
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
