import type { SMExpenseListItemProps } from '@/components/sm';
import { formatExpenseDate, formatPaise } from '@/lib/money';
import { categoryIcon } from './ledger';

/**
 * The fields of an expense that a list row needs.
 *
 * The payer arrives two ways: the analytics endpoint flattens it to `payerName`, while the
 * expense list nests it under `payer`. Both are accepted here rather than made uniform at
 * the call sites, because reshaping a server response in a screen is how two lists start
 * disagreeing about the same expense.
 */
export type ExpenseRowSource = {
  title: string;
  amountPaise: number;
  mySharePaise?: number | null;
  payerName?: string;
  payer?: { fullName: string } | null;
  expenseDate: string;
  hasReceipt: boolean;
  involvement?: string;
  category?: string | null;
};

/**
 * Describes one expense the way every list in the group shows it.
 *
 * Shared by Overview and the Expenses section so the same expense cannot read "Your share
 * ₹120" in one list and something else in the other.
 *
 * EVERY FIGURE HERE COMES FROM THE SERVER. `mySharePaise` is the frozen share the splitter
 * stored at the time, and the lent amount is the difference between the total and that
 * stored share — a subtraction of two server values, not a re-split. Nothing in this
 * function decides how an expense divides.
 */
export function describeExpenseRow(
  expense: ExpenseRowSource,
): Pick<
  SMExpenseListItemProps,
  | 'title'
  | 'amount'
  | 'payerLabel'
  | 'dateLabel'
  | 'hasReceipt'
  | 'shareLabel'
  | 'shareTone'
  | 'categoryIcon'
> {
  const mine = expense.involvement === 'paid_by_me';
  const uninvolved = expense.involvement === 'not_involved';
  const lent = expense.amountPaise - (expense.mySharePaise ?? 0);
  const payer = expense.payerName ?? expense.payer?.fullName ?? 'Someone';

  return {
    title: expense.title,
    amount: formatPaise(expense.amountPaise, { compact: true }),
    payerLabel: mine ? 'You paid' : payer + ' paid',
    dateLabel: formatExpenseDate(expense.expenseDate),
    hasReceipt: expense.hasReceipt,
    categoryIcon: categoryIcon(expense.category ?? null),
    shareLabel: uninvolved
      ? undefined
      : mine
        ? lent > 0
          ? 'You lent ' + formatPaise(lent, { compact: true })
          : undefined
        : 'Your share ' + formatPaise(expense.mySharePaise ?? 0, { compact: true }),
    shareTone: uninvolved ? 'neutral' : mine ? 'owed' : 'owing',
  };
}
