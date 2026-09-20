import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { createExpense, updateExpense, type ExpenseInput } from '@/lib/domainApi';
import { formatPaise, parseRupeesToPaise } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/dateRange';
import { ReceiptUpload } from '@/components/ReceiptUpload';
import { SplitEditor } from './SplitEditor';
import { evaluateSplit, isUnequalSplit, TOTAL_BASIS_POINTS } from '@/lib/split';
import type {
  Expense,
  ExpenseCategory,
  PaymentMode,
  PersonRef,
  SplitType,
} from '@/types/domain';

/**
 * Add / edit expense.
 *
 * Uses the `sheet` dialog variant: near-full-screen on a phone with a fixed header, an
 * independently scrolling body and a sticky footer action, and a centred card from
 * tablet up. Radix locks background scroll while it is open and restores the page's
 * scroll position on close.
 *
 * Field order follows the spec: title, amount, paid by, split mode, participants,
 * payment mode, date, notes.
 */

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'food_dining', label: 'Food & Dining' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'travel', label: 'Travel' },
  { value: 'household', label: 'Household' },
  { value: 'medical', label: 'Medical' },
  { value: 'other', label: 'Other' },
];

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: PersonRef[];
  currentUserId: string;
  /** Present when editing; absent when creating. */
  expense?: Expense | null;
  onSaved: () => void;
}

type FormErrors = Partial<Record<string, string>>;

export const AddExpenseDialog: React.FC<AddExpenseDialogProps> = ({
  open,
  onOpenChange,
  groupId,
  members,
  currentUserId,
  expense = null,
  onSaved,
}) => {
  const isEditing = Boolean(expense);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState<SplitType>('everyone');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  /** Raw text per member for an unequal split, keyed by user id. */
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [expenseDate, setExpenseDate] = useState(toLocalIsoDate(new Date()));
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<{ url: string; publicId: string } | null>(null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset to a clean form (or the expense being edited) each time the dialog opens.
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(false);

    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toFixed(2));
      setPaidBy(expense.paidBy);
      setSplitType(expense.splitType);
      setParticipantIds(expense.participants.map((participant) => participant.userId));
      // Reopen on what was originally entered, not on the paise it resolved to.
      setSplitValues(
        Object.fromEntries(
          expense.participants.map((participant) => {
            if (expense.splitType === 'exact') {
              return [participant.userId, (participant.sharePaise / 100).toFixed(2)];
            }
            if (expense.splitType === 'percentage') {
              return [participant.userId, ((participant.splitValue ?? 0) / 100).toString()];
            }
            if (expense.splitType === 'shares') {
              return [participant.userId, String(participant.splitValue ?? 0)];
            }
            return [participant.userId, ''];
          }),
        ),
      );
      setPaymentMode(expense.paymentMode);
      setCategory(expense.category ?? '');
      setExpenseDate(expense.expenseDate);
      setNotes(expense.notes);
      setReceipt(
        expense.receiptUrl ? { url: expense.receiptUrl, publicId: '' } : null,
      );
    } else {
      setTitle('');
      setAmount('');
      setPaidBy(currentUserId);
      setSplitType('everyone');
      setParticipantIds(members.map((member) => member.id));
      setSplitValues({});
      setPaymentMode('cash');
      setCategory('');
      setExpenseDate(toLocalIsoDate(new Date()));
      setNotes('');
      setReceipt(null);
    }
  }, [open, expense, currentUserId, members]);

  const amountPaise = useMemo(() => parseRupeesToPaise(amount), [amount]);

  const effectiveParticipants = useMemo(
    () => (splitType === 'everyone' ? members.map((member) => member.id) : participantIds),
    [splitType, participantIds, members],
  );

  /**
   * Live preview of the split, using the same remainder rule as the server so the
   * figures shown are exactly what will be stored.
   */
  const sharePreview = useMemo(() => {
    // The unequal modes have their own per-person preview; showing "₹250 each" under a
    // 60/40 split would contradict it.
    if (isUnequalSplit(splitType)) return null;
    if (!amountPaise || effectiveParticipants.length === 0) return null;
    const count = effectiveParticipants.length;
    const base = Math.floor(amountPaise / count);
    const remainder = amountPaise % count;
    return {
      count,
      low: base,
      high: remainder > 0 ? base + 1 : base,
      hasRemainder: remainder > 0,
    };
  }, [amountPaise, effectiveParticipants, splitType]);

  /**
   * Resolves the unequal split as typed, using the same allocator as the server so the
   * preview matches what will be stored.
   */
  const splitEvaluation = useMemo(
    () =>
      evaluateSplit(
        splitType,
        members.map((member) => ({ userId: member.id, raw: splitValues[member.id] ?? '' })),
        amountPaise,
        parseRupeesToPaise,
      ),
    [splitType, members, splitValues, amountPaise],
  );

  /** Seeds a newly chosen mode with an even starting point rather than empty boxes. */
  const handleSplitTypeChange = (next: SplitType) => {
    setSplitType(next);
    setErrors((prev) => ({ ...prev, participantIds: undefined, splits: undefined }));

    if (!isUnequalSplit(next)) return;

    setSplitValues((prev) => {
      // Keep what the user already typed when switching between unequal modes only if
      // the unit is unchanged; otherwise the numbers would mean something different.
      const hasValues = members.some((member) => (prev[member.id] ?? '').trim() !== '');
      if (hasValues && isUnequalSplit(splitType) && splitType === next) return prev;

      if (next === 'shares') {
        return Object.fromEntries(members.map((member) => [member.id, '1']));
      }
      if (next === 'percentage') {
        const even = Math.floor(TOTAL_BASIS_POINTS / Math.max(members.length, 1));
        return Object.fromEntries(
          members.map((member, index) => [
            member.id,
            // The first person absorbs the rounding so the seed already totals 100%.
            (
              (index === 0
                ? even + (TOTAL_BASIS_POINTS - even * members.length)
                : even) / 100
            ).toString(),
          ]),
        );
      }
      return Object.fromEntries(members.map((member) => [member.id, '']));
    });
  };

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
    setErrors((prev) => ({ ...prev, participantIds: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!title.trim()) next.title = 'Give this expense a title';
    if (amountPaise === null) next.amount = 'Enter a valid amount, up to two decimal places';
    else if (amountPaise <= 0) next.amount = 'Amount must be greater than zero';

    if (splitType === 'specific' && participantIds.length === 0) {
      next.participantIds = 'Select at least one participant';
    }
    if (isUnequalSplit(splitType) && !splitEvaluation.isBalanced) {
      next.splits =
        splitEvaluation.message ??
        (splitEvaluation.hasInvalidRow
          ? 'One of the shares is not a valid number'
          : 'The shares do not add up yet');
    }
    if (!expenseDate) next.expenseDate = 'Choose a date';
    else if (expenseDate > toLocalIsoDate(new Date(Date.now() + 86_400_000))) {
      next.expenseDate = 'An expense cannot be dated in the future';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Guard against a double submit from a fast double-tap.
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: ExpenseInput = {
      title: title.trim(),
      amount,
      paidBy,
      splitType,
      participantIds: splitType === 'specific' ? participantIds : undefined,
      // An unequal split is defined entirely by its per-person figures; the server
      // rejects a participant list alongside them.
      splits: isUnequalSplit(splitType)
        ? splitEvaluation.values.map((row) => ({
            userId: row.userId,
            // Back into the units the API speaks: rupees, percent, or a raw weight.
            // `evaluateSplit` holds them as paise, basis points and weights.
            value: splitType === 'shares' ? row.value : row.value / 100,
          }))
        : undefined,
      paymentMode,
      category: category === '' ? null : category,
      expenseDate,
      notes: notes.trim(),
      receiptUrl: receipt?.url ?? null,
      receiptStorageKey: receipt?.publicId || null,
    };

    try {
      if (isEditing && expense) await updateExpense(groupId, expense.id, payload);
      else await createExpense(groupId, payload);

      onSaved();
      onOpenChange(false);
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        // Map server field errors back onto the form where possible.
        if (error.fields?.length) {
          const mapped: FormErrors = {};
          for (const field of error.fields) mapped[field.field] = field.message;
          setErrors(mapped);
          setSubmitError('Please check the highlighted fields.');
        } else {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit expense' : 'Add expense'}</DialogTitle>
        </DialogHeader>

        {/* The form wraps body + footer so the sticky submit button still submits it. */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* 1. Title */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-title">Expense title</Label>
              <Input
                id="expense-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Dinner at Truffles"
                autoComplete="off"
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'expense-title-error' : undefined}
              />
              {errors.title && (
                <p id="expense-title-error" role="alert" className="text-sm text-destructive">
                  {errors.title}
                </p>
              )}
            </div>

            {/* 2. Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="expense-amount"
                  // `decimal` gives phones a numeric keypad with a decimal point.
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="pl-8"
                  aria-invalid={Boolean(errors.amount)}
                />
              </div>
              {errors.amount && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.amount}
                </p>
              )}
            </div>

            {/* 3. Paid by */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-payer">Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger id="expense-payer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.id === currentUserId ? 'You' : member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Split mode */}
            <div className="space-y-2">
              <Label>Split</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'everyone', label: 'Equally' },
                    { value: 'specific', label: 'Some people' },
                    { value: 'exact', label: 'Exact amounts' },
                    { value: 'percentage', label: 'Percentages' },
                    { value: 'shares', label: 'Shares' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSplitTypeChange(option.value)}
                    aria-pressed={splitType === option.value}
                    className={cn(
                      'flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      splitType === option.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {splitType === option.value && <Check className="h-4 w-4" />}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Participants */}
            {splitType === 'specific' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Participants</Label>
                  <span className="text-xs font-medium text-muted-foreground">
                    {participantIds.length} selected
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  {members.map((member, index) => {
                    const checked = participantIds.includes(member.id);
                    return (
                      // The whole row is the tap target, not just the checkbox.
                      <label
                        key={member.id}
                        className={cn(
                          'flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2 transition-colors',
                          index > 0 && 'border-t border-border',
                          checked ? 'bg-primary/5' : 'bg-card hover:bg-accent',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleParticipant(member.id)}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {member.id === currentUserId ? 'You' : member.fullName}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errors.participantIds && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.participantIds}
                  </p>
                )}
              </div>
            )}

            {/* 5b. Per-person shares for the unequal modes. */}
            {isUnequalSplit(splitType) && (
              <SplitEditor
                splitType={splitType}
                members={members}
                currentUserId={currentUserId}
                values={splitValues}
                onChange={(userId, value) => {
                  setSplitValues((prev) => ({ ...prev, [userId]: value }));
                  setErrors((prev) => ({ ...prev, splits: undefined }));
                }}
                evaluation={splitEvaluation}
                amountPaise={amountPaise}
                error={errors.splits}
              />
            )}

            {/* Split preview — exactly what the server will store. */}
            {sharePreview && (
              <div className="flex items-start gap-2.5 rounded-xl bg-muted p-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Split {sharePreview.count} ways —{' '}
                  <span className="font-semibold text-foreground">
                    {sharePreview.hasRemainder
                      ? `${formatPaise(sharePreview.low)} – ${formatPaise(sharePreview.high)}`
                      : formatPaise(sharePreview.low)}
                  </span>{' '}
                  each
                  {sharePreview.hasRemainder && (
                    <span className="block text-xs text-muted-foreground">
                      The leftover paisa goes to the first few people so the split adds up
                      exactly.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* 6. Payment mode */}
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'cash', label: 'Cash' },
                    { value: 'upi', label: 'UPI / Online' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentMode(option.value)}
                    aria-pressed={paymentMode === option.value}
                    className={cn(
                      'flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      paymentMode === option.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-category">Category (optional)</Label>
              <Select
                value={category || 'none'}
                onValueChange={(value) =>
                  setCategory(value === 'none' ? '' : (value as ExpenseCategory))
                }
              >
                <SelectTrigger id="expense-category">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 7. Date */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                max={toLocalIsoDate(new Date())}
                onChange={(event) => setExpenseDate(event.target.value)}
                aria-invalid={Boolean(errors.expenseDate)}
              />
              {errors.expenseDate && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.expenseDate}
                </p>
              )}
            </div>

            {/* 9. Receipt */}
            <ReceiptUpload
              value={receipt?.url ?? null}
              onChange={setReceipt}
              label="Receipt (optional)"
              folder="splitmoney/receipts"
              disabled={isSubmitting}
            />

            {/* 8. Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-notes">Notes (optional)</Label>
              <Textarea
                id="expense-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything worth remembering about this expense"
                rows={3}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="sm:min-w-[160px]">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting
                ? isEditing
                  ? 'Saving…'
                  : 'Adding expense…'
                : isEditing
                  ? 'Save changes'
                  : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
