import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { expenses as expensesApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import type { Expense, ExpenseInput, PaymentMode, SplitType } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup } from '@/features/group/GroupContext';
import { canModifyExpense } from '@/features/group/permissions';
import { categoryIcon } from '@/features/group/ledger';
import { useAuth } from '@/auth/AuthProvider';
import {
  SMAmountInput,
  SMAvatar,
  SMButton,
  SMDateField,
  SMEmptyState,
  SMErrorState,
  SMScreenHeader,
  SMImagePicker,
  SMInlineNotice,
  SMOptionRow,
  SMRowSkeleton,
  SMSelectField,
  SMSheet,
  SMTextInput,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import {
  CATEGORIES,
  categoryLabel,
  formatPaise,
  SPLIT_LABELS,
  SPLIT_MODES,
  todayIso,
} from '@/lib/money';
import { MAX_AMOUNT_PAISE, sanitizeAmount, sanitizeShares } from '@/lib/amountInput';

/**
 * Add or edit an expense.
 *
 * What this screen does NOT do:
 * It does not compute split shares on device — the backend owns authoritative split
 * calculations and reconciles rounding paise.
 *
 * What it does do:
 * Pre-flight validation (percentages reach 100%, exact shares sum to total, non-empty)
 * to give immediate user feedback before network roundtrip.
 */

type SheetName = 'payer' | 'split' | 'category' | 'payment' | 'participants' | null;

/** One line under each split mode, so the choice is understood before it is made. */
const SPLIT_HINTS: Record<SplitType, string> = {
  everyone: 'Divided equally between everyone in the group',
  specific: 'Divided equally between the people you pick',
  exact: 'You enter exactly how much each person owes',
  percentage: 'You enter a percentage for each person',
  shares: 'You enter a weight — 2 counts double, 1 is normal',
};

export default function ExpenseFormScreen() {
  const { colors } = useTheme();
  const { groupId, detail, refresh } = useGroup();
  const { user } = useAuth();
  const router = useRouter();
  const { expenseId } = useLocalSearchParams<{ expenseId?: string }>();

  const editing = Boolean(expenseId);
  const members = detail?.members ?? [];

  const existing = useRequest<{ expense: Expense }>(
    useCallback(
      (signal: AbortSignal) =>
        expenseId
          ? expensesApi.get(groupId, expenseId, signal)
          : Promise.resolve({ expense: undefined as unknown as Expense }),
      [groupId, expenseId],
    ),
    [groupId, expenseId],
  );

  const leave = (): void =>
    router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never);

  if (editing && existing.loading && !existing.data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <SMScreenHeader title="Edit expense" onBack={leave} />
        <View style={styles.skeleton}>
          <SMRowSkeleton rows={5} />
        </View>
      </SafeAreaView>
    );
  }

  if (editing && existing.error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <SMScreenHeader title="Edit expense" onBack={leave} />
        <SMErrorState error={existing.error} onRetry={() => void existing.refresh()} />
      </SafeAreaView>
    );
  }

  /*
   * Only the payer may edit. The detail screen already hides the Edit button from everyone
   * else, but this route can still be reached by a link or the back stack, so it guards
   * itself too: a non-payer is told why, rather than handed a form that will be refused
   * the moment they save. The server's check is the one that actually decides.
   */
  const loaded = existing.data?.expense;
  if (editing && loaded && !canModifyExpense(loaded, user?.id)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <SMScreenHeader title="Edit expense" onBack={leave} />
        <SMEmptyState
          icon="lock"
          title="Only the payer can edit this"
          description={
            (loaded.payer?.fullName ?? 'The person who paid') +
            ' paid for this expense, so only they can change or delete it.'
          }
          primaryAction={{ label: 'Go back', onPress: leave }}
        />
      </SafeAreaView>
    );
  }

  return (
    <Form
      key={expenseId ?? 'new'}
      groupId={groupId}
      members={members}
      meId={user?.id ?? ''}
      expense={editing ? loaded : undefined}
      onSaved={() => {
        void refresh();
        leave();
      }}
      onCancel={leave}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* The Form                                                                   */
/* -------------------------------------------------------------------------- */

type Member = { id: string; fullName: string };

function Form({
  groupId,
  members,
  meId,
  expense,
  onSaved,
  onCancel,
}: {
  groupId: string;
  members: Member[];
  meId: string;
  expense: Expense | undefined;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { colors, dark } = useTheme();
  const amountRef = useRef<TextInput>(null);

  /* State seeded once from props */
  const [title, setTitle] = useState(expense?.title ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? meId);
  const [splitType, setSplitType] = useState<SplitType>(expense?.splitType ?? 'everyone');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(expense?.paymentMode ?? 'cash');
  const [category, setCategory] = useState<string | null>(expense?.category ?? null);
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? todayIso());
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense?.receiptUrl ?? null);

  const [participantIds, setParticipantIds] = useState<string[]>(() =>
    expense && expense.splitType === 'specific'
      ? expense.participants.map((p) => p.userId)
      : members.map((m) => m.id),
  );

  const [splitValues, setSplitValues] = useState<Record<string, string>>(() => {
    if (!expense || !['exact', 'percentage', 'shares'].includes(expense.splitType)) return {};
    const out: Record<string, string> = {};
    for (const participant of expense.participants) {
      if (expense.splitType === 'exact') out[participant.userId] = String(participant.share);
      else if (participant.splitValue !== null) out[participant.userId] = String(participant.splitValue);
    }
    return out;
  });

  const [sheet, setSheet] = useState<SheetName>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const inFlight = useRef(false);

  const nameOf = (id: string): string => members.find((m) => m.id === id)?.fullName ?? 'Someone';
  const unequal = splitType === 'exact' || splitType === 'percentage' || splitType === 'shares';

  /* Pre-flight checks */
  const amountPaise = useMemo(() => {
    const parsed = Number(amount.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
  }, [amount]);

  const entered = useMemo(() => {
    const out: { userId: string; value: number }[] = [];
    for (const [userId, raw] of Object.entries(splitValues)) {
      const parsed = Number(String(raw).replace(/,/g, ''));
      if (raw !== '' && Number.isFinite(parsed) && parsed > 0) out.push({ userId, value: parsed });
    }
    return out;
  }, [splitValues]);

  const splitProblem = useMemo((): string | null => {
    if (splitType === 'specific' && participantIds.length === 0) {
      return 'Choose at least one person to split with.';
    }
    if (!unequal) return null;
    if (entered.length === 0) return 'Enter a share figure for at least one person.';

    if (splitType === 'percentage') {
      const points = entered.reduce((sum, e) => sum + Math.round(e.value * 100), 0);
      if (points !== 10_000) {
        return 'Percentages add up to ' + (points / 100).toFixed(2) + '%, must be exactly 100%.';
      }
    }

    if (splitType === 'exact') {
      if (!Number.isFinite(amountPaise)) return 'Enter the total amount first.';
      const sum = entered.reduce((total, e) => total + Math.round(e.value * 100), 0);
      if (sum !== amountPaise) {
        const diff = amountPaise - sum;
        return (
          'Shares add up to ' +
          formatPaise(sum) +
          ', which is ' +
          formatPaise(Math.abs(diff)) +
          (diff > 0 ? ' short of ' : ' more than ') +
          formatPaise(amountPaise) +
          '.'
        );
      }
    }

    return null;
  }, [splitType, unequal, entered, participantIds, amountPaise]);

  const canSubmit =
    title.trim().length > 0 &&
    amount.trim().length > 0 &&
    Number.isFinite(amountPaise) &&
    amountPaise > 0 &&
    splitProblem === null;

  /* Submit handler */
  const submit = async (): Promise<void> => {
    if (inFlight.current || submitting) return;

    const problems: Record<string, string> = {};
    if (!title.trim()) problems.title = 'Give this expense a name.';
    if (!amount.trim()) problems.amount = 'Enter an amount.';
    else if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      problems.amount = 'Enter an amount greater than zero.';
    }
    if (Object.keys(problems).length > 0 || splitProblem) {
      setFieldErrors(problems);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    setFieldErrors({});

    const payload: ExpenseInput = {
      title: title.trim(),
      amount: amount.trim(),
      paidBy,
      splitType,
      paymentMode,
      category,
      expenseDate,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      receiptUrl,
      ...(splitType === 'specific' ? { participantIds } : {}),
      ...(unequal
        ? { splits: entered.map((e) => ({ userId: e.userId, value: String(e.value) })) }
        : {}),
    };

    try {
      if (expense) await expensesApi.update(groupId, expense.id, payload);
      else await expensesApi.create(groupId, payload);
      onSaved();
    } catch (caught: unknown) {
      setError(caught);
      if (caught instanceof ApiError && caught.fields) setFieldErrors(caught.fields);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const problem = error ? describeError(error) : undefined;

  /*
   * ======================================================================
   * Everything above this line is the form's original logic, unchanged.
   * Everything below is presentation only: it reads that state and calls
   * the same setters and the same `submit`.
   * ======================================================================
   */

  // Past the server's ceiling the save would be refused; say so before it is attempted.
  const overMax = Number.isFinite(amountPaise) && amountPaise > MAX_AMOUNT_PAISE;
  const amountError =
    fieldErrors.amount ??
    (overMax ? 'The most one expense can be is ' + formatPaise(MAX_AMOUNT_PAISE) + '.' : undefined);

  const confirmation =
    Number.isFinite(amountPaise) && amountPaise > 0 && !overMax ? formatPaise(amountPaise) : undefined;

  const splitSanitize = splitType === 'shares' ? sanitizeShares : sanitizeAmount;

  const participantSummary =
    participantIds.length === members.length
      ? 'Everyone (' + members.length + ')'
      : participantIds.length === 0
        ? 'Nobody selected'
        : participantIds.length === 1
          ? nameOf(participantIds[0] ?? '')
          : participantIds.length + ' people';

  const splitHeading =
    splitType === 'exact'
      ? 'Amount per person'
      : splitType === 'percentage'
        ? 'Percentage per person'
        : 'Shares per person';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <SMScreenHeader
        title={expense ? 'Edit expense' : 'Add expense'}
        onBack={onCancel}
        variant="close"
      />

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* ---- What, and how much ---- */}
          <Section title="What was it?">
            <SMTextInput
              label="Description"
              required
              value={title}
              onChangeText={setTitle}
              {...(fieldErrors.title ? { error: fieldErrors.title } : {})}
              placeholder="Dinner, groceries, fuel…"
              leftIcon="tag"
              maxLength={120}
              returnKeyType="next"
              onSubmitEditing={() => amountRef.current?.focus()}
              blurOnSubmit={false}
              editable={!submitting}
              autoCapitalize="sentences"
            />

            <SMAmountInput
              ref={amountRef}
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              {...(amountError ? { error: amountError } : {})}
              {...(confirmation ? { confirmation } : {})}
              editable={!submitting}
            />
          </Section>

          {/* ---- Who paid, and how it divides ---- */}
          <Section title="Paid by and split">
            <SMSelectField
              label="Paid by"
              value={paidBy === meId ? 'You' : nameOf(paidBy)}
              leading={<SMAvatar name={nameOf(paidBy)} size={36} round />}
              onPress={() => setSheet('payer')}
              disabled={submitting}
            />

            <SMSelectField
              label="Split"
              value={SPLIT_LABELS[splitType]}
              detail={SPLIT_HINTS[splitType]}
              icon="balance"
              onPress={() => setSheet('split')}
              disabled={submitting}
            />

            {splitType === 'specific' ? (
              <SMSelectField
                label="Between"
                value={participantSummary}
                icon="users"
                onPress={() => setSheet('participants')}
                {...(splitProblem ? { error: splitProblem } : {})}
                disabled={submitting}
              />
            ) : null}

            {unequal ? (
              <View style={styles.splitBlock}>
                <Text style={[styles.splitHeading, { color: colors.text }]}>{splitHeading}</Text>
                <Text style={[styles.splitHint, { color: colors.muted }]}>
                  {splitType === 'exact'
                    ? 'Leave someone blank to leave them out. The amounts must add up to the total.'
                    : splitType === 'percentage'
                      ? 'Leave someone blank to leave them out. The percentages must add up to 100%.'
                      : 'Leave someone blank to leave them out.'}
                </Text>

                {members.map((member) => (
                  <View key={member.id} style={styles.splitRow}>
                    <SMAvatar name={member.fullName} size={34} round />
                    <Text numberOfLines={1} style={[styles.splitName, { color: colors.text }]}>
                      {member.id === meId ? 'You' : member.fullName}
                    </Text>
                    <View
                      style={[
                        styles.splitInputBox,
                        {
                          borderColor: dark ? colors.borderStrong : colors.border,
                          backgroundColor: dark ? colors.surface : colors.surfaceElevated ?? colors.surface,
                        },
                      ]}
                    >
                      {splitType === 'exact' ? (
                        <Text style={[styles.splitAffix, { color: colors.muted }]}>₹</Text>
                      ) : null}
                      <TextInput
                        value={splitValues[member.id] ?? ''}
                        onChangeText={(value) =>
                          setSplitValues((current) => ({ ...current, [member.id]: splitSanitize(value) }))
                        }
                        placeholder={splitType === 'shares' ? '1' : '0'}
                        placeholderTextColor={colors.muted}
                        keyboardType={splitType === 'shares' ? 'number-pad' : 'decimal-pad'}
                        inputMode={splitType === 'shares' ? 'numeric' : 'decimal'}
                        editable={!submitting}
                        accessibilityLabel={
                          (member.id === meId ? 'Your ' : member.fullName + '’s ') +
                          (splitType === 'exact' ? 'amount' : splitType === 'percentage' ? 'percentage' : 'shares')
                        }
                        style={[styles.splitInput, { color: colors.text }]}
                      />
                      {splitType === 'percentage' ? (
                        <Text style={[styles.splitAffix, { color: colors.muted }]}>%</Text>
                      ) : null}
                    </View>
                  </View>
                ))}

                {splitProblem ? (
                  <SMInlineNotice type="error" message={splitProblem} />
                ) : (
                  <SMInlineNotice
                    type="success"
                    message={
                      splitType === 'shares' ? 'Shares are set.' : 'Everything adds up.'
                    }
                  />
                )}
              </View>
            ) : null}
          </Section>

          {/* ---- When, what kind, how ---- */}
          <Section title="Details">
            <SMDateField
              label="Date"
              value={expenseDate}
              onChange={setExpenseDate}
              {...(fieldErrors.expenseDate ? { error: fieldErrors.expenseDate } : {})}
              disabled={submitting}
            />

            <SMSelectField
              label="Category"
              value={category ? categoryLabel(category) : 'General'}
              icon={categoryIcon(category)}
              onPress={() => setSheet('category')}
              disabled={submitting}
            />

            <SMSelectField
              label="Paid with"
              value={paymentMode === 'upi' ? 'UPI' : 'Cash'}
              icon="money"
              onPress={() => setSheet('payment')}
              disabled={submitting}
            />
          </Section>

          {/* ---- Optional extras, visually quieter ---- */}
          <Section title="Notes and receipt" optional>
            <SMTextInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              {...(fieldErrors.notes ? { error: fieldErrors.notes } : {})}
              placeholder="Anything worth remembering"
              multiline
              maxLength={500}
              editable={!submitting}
              style={styles.notes}
            />

            <SMImagePicker
              variant="receipt"
              label="Receipt"
              url={receiptUrl}
              folder="splitwise/receipts"
              onChange={(image) => setReceiptUrl(image ? image.url : null)}
              disabled={submitting}
            />
          </Section>

          {problem ? (
            <SMInlineNotice type="error" title={problem.title} message={problem.message} />
          ) : null}
        </ScrollView>

        {/* ---- The action stays reachable above the keyboard ---- */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: dark ? colors.borderStrong : colors.border,
            },
          ]}
        >
          <SMButton
            label={expense ? 'Save changes' : 'Add expense'}
            loadingLabel="Saving…"
            icon={expense ? 'check' : 'add'}
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={!canSubmit || overMax}
            onPress={() => void submit()}
            accessibilityHint={
              canSubmit && !overMax
                ? undefined
                : 'Add a description and an amount, and make sure the split adds up'
            }
          />
        </View>
      </KeyboardAvoidingView>

      {/* ---- Sheets ---- */}

      <SMSheet visible={sheet === 'payer'} onClose={() => setSheet(null)} title="Who paid?">
        {members.map((member) => (
          <SMOptionRow
            key={member.id}
            label={member.id === meId ? 'You' : member.fullName}
            selected={paidBy === member.id}
            leading={<SMAvatar name={member.fullName} size={32} round />}
            onPress={() => {
              setPaidBy(member.id);
              setSheet(null);
            }}
          />
        ))}
      </SMSheet>

      <SMSheet visible={sheet === 'split'} onClose={() => setSheet(null)} title="How should it be split?">
        {SPLIT_MODES.map((mode) => (
          <SMOptionRow
            key={mode}
            label={SPLIT_LABELS[mode]}
            detail={SPLIT_HINTS[mode]}
            selected={splitType === mode}
            onPress={() => {
              setSplitType(mode);
              setSheet(null);
            }}
          />
        ))}
      </SMSheet>

      <SMSheet
        visible={sheet === 'participants'}
        onClose={() => setSheet(null)}
        title="Split between"
        subtitle={participantIds.length + ' of ' + members.length + ' selected'}
        footer={<SMButton label="Done" variant="primary" fullWidth onPress={() => setSheet(null)} />}
      >
        {members.map((member) => {
          const on = participantIds.includes(member.id);
          return (
            <SMOptionRow
              key={member.id}
              mode="checkbox"
              label={member.id === meId ? 'You' : member.fullName}
              selected={on}
              leading={<SMAvatar name={member.fullName} size={32} round />}
              onPress={() =>
                setParticipantIds((current) =>
                  on ? current.filter((id) => id !== member.id) : [...current, member.id],
                )
              }
            />
          );
        })}
      </SMSheet>

      <SMSheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Category">
        <SMOptionRow
          label="General"
          icon="expense"
          selected={category === null}
          onPress={() => {
            setCategory(null);
            setSheet(null);
          }}
        />
        {CATEGORIES.map((value) => (
          <SMOptionRow
            key={value}
            label={categoryLabel(value)}
            icon={categoryIcon(value)}
            selected={category === value}
            onPress={() => {
              setCategory(value);
              setSheet(null);
            }}
          />
        ))}
      </SMSheet>

      <SMSheet visible={sheet === 'payment'} onClose={() => setSheet(null)} title="Paid with">
        {(['cash', 'upi'] as PaymentMode[]).map((mode) => (
          <SMOptionRow
            key={mode}
            label={mode === 'upi' ? 'UPI' : 'Cash'}
            icon="money"
            selected={paymentMode === mode}
            onPress={() => {
              setPaymentMode(mode);
              setSheet(null);
            }}
          />
        ))}
      </SMSheet>
    </SafeAreaView>
  );
}

/**
 * A titled group of fields.
 *
 * Titles are small and muted: they orient, and the fields beneath them are the content.
 * An optional section says so in its title, so nobody wonders whether a receipt is required
 * before they can save.
 */
function Section({
  title,
  optional = false,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>
          {title}
        </Text>
        {optional ? (
          <Text style={[styles.sectionOptional, { color: colors.muted }]}>Optional</Text>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  skeleton: { padding: spacing.base },
  body: { padding: spacing.base, gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionOptional: { fontSize: typography.xs, fontWeight: '600' },
  sectionBody: { gap: spacing.md },
  notes: { minHeight: 84, textAlignVertical: 'top' },
  splitBlock: { gap: spacing.sm, paddingTop: spacing.xs },
  splitHeading: { fontSize: typography.bodySm, fontWeight: '700' },
  splitHint: { fontSize: typography.caption, lineHeight: 18 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  splitName: { flex: 1, fontSize: typography.bodySm, fontWeight: '600' },
  splitInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 128,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    gap: 4,
  },
  splitAffix: { fontSize: typography.bodySm, fontWeight: '700' },
  splitInput: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
  },
});
