import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { Avatar, Badge, Card, type BadgeTone } from '@/components/ui';
import { Icon } from '@/components/Icon';
import {
  categoryLabel,
  formatExpenseDate,
  formatInstant,
  formatPaise,
  SETTLEMENT_STATUS_LABELS,
} from '@/lib/money';
import type { DueEntry, Expense, Settlement } from '@/api/types';

/* -------------------------------------------------------------------------- */
/* Expense                                                                    */
/* -------------------------------------------------------------------------- */

export function ExpenseCard({
  expense,
  onPress,
}: {
  expense: Expense;
  onPress?: () => void;
}) {
  const { colors } = useTheme();

  const payerName = expense.payer?.fullName ?? 'Someone';
  const mine = expense.involvement === 'paid_by_me';

  const shareLine = (): { text: string; tone: string; isLent: boolean } => {
    if (expense.involvement === 'not_involved') {
      return { text: 'Not involved', tone: colors.muted, isLent: false };
    }
    if (mine) {
      const lent = expense.amountPaise - (expense.mySharePaise ?? 0);
      return lent > 0
        ? { text: `You lent ${formatPaise(lent, { compact: true })}`, tone: colors.success, isLent: true }
        : { text: 'You paid (all yours)', tone: colors.muted, isLent: false };
    }
    return {
      text: `You owe ${formatPaise(expense.mySharePaise ?? 0, { compact: true })}`,
      tone: colors.destructive,
      isLent: false,
    };
  };

  const share = shareLine();

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        expense.title +
        ', ' +
        formatPaise(expense.amountPaise, { compact: true }) +
        ', paid by ' +
        (mine ? 'you' : payerName) +
        ', ' +
        formatExpenseDate(expense.expenseDate)
      }
    >
      <View style={styles.row}>
        <Avatar name={payerName} size={42} />

        <View style={styles.body}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}
          >
            {expense.title}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
            {(mine ? 'You' : payerName) + ' paid · ' + formatExpenseDate(expense.expenseDate)}
          </Text>
        </View>

        <View style={styles.amount}>
          <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
            {formatPaise(expense.amountPaise, { compact: true })}
          </Text>
          <Text style={{ color: share.tone, fontSize: typography.caption, fontWeight: '600' }} numberOfLines={1}>
            {share.text}
          </Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Badge label={categoryLabel(expense.category)} />
        <Badge label={expense.paymentMode === 'upi' ? 'UPI' : 'Cash'} />
        <Badge
          label={
            expense.participantCount + (expense.participantCount === 1 ? ' person' : ' people')
          }
        />
        {expense.hasReceipt ? <Badge label="Receipt" tone="info" /> : null}
      </View>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Settlement                                                                 */
/* -------------------------------------------------------------------------- */

const STATUS_TONE: Record<string, BadgeTone> = {
  completed: 'positive',
  rejected: 'negative',
  cancelled: 'neutral',
  paid_pending_approval: 'warning',
  will_pay_soon: 'info',
};

export function SettlementCard({
  settlement,
  payerName,
  receiverName,
  onPress,
}: {
  settlement: Settlement;
  payerName: string;
  receiverName: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const outgoing = settlement.direction === 'outgoing';

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        payerName +
        ' to ' +
        receiverName +
        ', ' +
        formatPaise(settlement.amountPaise, { compact: true }) +
        ', ' +
        (SETTLEMENT_STATUS_LABELS[settlement.status] ?? settlement.status)
      }
    >
      <View style={styles.row}>
        <Avatar name={outgoing ? receiverName : payerName} size={42} />

        <View style={styles.body}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}
          >
            {outgoing ? 'You paid ' + receiverName : payerName + ' paid you'}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: typography.caption }}>
            {formatInstant(settlement.paidAt)}
          </Text>
        </View>

        <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '800' }}>
          {formatPaise(settlement.amountPaise, { compact: true })}
        </Text>
      </View>

      <View style={styles.meta}>
        <Badge
          label={SETTLEMENT_STATUS_LABELS[settlement.status] ?? settlement.status}
          tone={STATUS_TONE[settlement.status] ?? 'neutral'}
        />
        <Badge label={settlement.paymentMethod === 'upi' ? 'UPI' : 'Cash'} />
        {settlement.hasProof ? <Badge label="Screenshot attached" tone="info" /> : null}
      </View>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Person balance                                                             */
/* -------------------------------------------------------------------------- */

export function PersonBalanceCard({
  entry,
  direction,
  onPress,
}: {
  entry: DueEntry;
  direction: 'i_owe' | 'they_owe';
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const owing = direction === 'i_owe';

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        entry.user.fullName +
        ', ' +
        (owing ? 'you owe ' : 'owes you ') +
        formatPaise(entry.amountPaise, { compact: true })
      }
    >
      <View style={styles.row}>
        <Avatar name={entry.user.fullName} size={44} />

        <View style={styles.body}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}
          >
            {entry.user.fullName}
          </Text>
          <Text style={{ color: colors.muted, fontSize: typography.caption }}>
            {owing ? 'You owe them' : 'Owes you'} · Tap to inspect
          </Text>
        </View>

        <View style={styles.balanceRight}>
          <Text
            style={{
              color: owing ? colors.destructive : colors.success,
              fontSize: typography.bodySm,
              fontWeight: '800',
            }}
          >
            {formatPaise(entry.amountPaise, { compact: true })}
          </Text>
          <Icon name="forward" size={14} tone="muted" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  amount: { alignItems: 'flex-end', gap: 2, maxWidth: '48%' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xxs },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
