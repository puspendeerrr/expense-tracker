import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { expenses as expensesApi } from '@/api/endpoints';
import { ApiError, describeError } from '@/api/errors';
import type { Expense, ExpenseInput, PaymentMode, SplitType } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup } from '@/features/group/GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { ReceiptField } from '@/components/ReceiptField';
import { Sheet } from '@/components/Sheet';
import { Card, CardSkeleton, OptionRow, SectionHeader } from '@/components/ui';
import { ErrorState } from '@/components/StateViews';
import { Icon } from '@/components/Icon';
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

  if (editing && existing.loading && !existing.data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.skeletonContainer}>
          <CardSkeleton rows={6} />
        </View>
      </SafeAreaView>
    );
  }

  if (editing && existing.error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState error={existing.error} onRetry={() => void existing.refresh()} />
      </SafeAreaView>
    );
  }

  return (
    <Form
      key={expenseId ?? 'new'}
      groupId={groupId}
      members={members}
      meId={user?.id ?? ''}
      expense={editing ? existing.data?.expense : undefined}
      onSaved={() => {
        void refresh();
        if (router.canGoBack()) router.back();
        else router.replace(('/group/' + groupId) as never);
      }}
      onCancel={() => (router.canGoBack() ? router.back() : router.replace(('/group/' + groupId) as never))}
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
  const { colors, isDark } = useTheme();

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Modern Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          hitSlop={12}
          style={styles.headerButton}
        >
          <Icon name="close" size={20} tone="muted" />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: typography.titleSm, fontWeight: '800' }}
        >
          {expense ? 'Edit Expense' : 'Add Expense'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Amount & Description Card */}
          <Card style={styles.heroCard}>
            <View style={styles.amountHero}>
              <Text style={[styles.currencyPrefix, { color: colors.primary }]}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={isDark ? colors.border : '#CBD5E1'}
                keyboardType="decimal-pad"
                inputMode="decimal"
                editable={!submitting}
                style={[styles.amountInput, { color: colors.text }]}
                selectionColor={colors.primary}
              />
            </View>
            {fieldErrors.amount ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {fieldErrors.amount}
              </Text>
            ) : null}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TextField
              label="Expense Title"
              value={title}
              onChangeText={setTitle}
              error={fieldErrors.title}
              placeholder="What was this for? (e.g. Dinner, Grocery, Fuel)"
              leftIcon="tag"
              maxLength={120}
              returnKeyType="next"
              editable={!submitting}
            />
          </Card>

          {/* Quick Category Selector */}
          <View style={styles.quickCategoryContainer}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>CATEGORY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPills}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setCategory(null)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: category === null ? colors.primary : colors.surface,
                    borderColor: category === null ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: category === null ? colors.onPrimary : colors.text },
                  ]}
                >
                  General
                </Text>
              </Pressable>
              {CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <Pressable
                    key={cat}
                    accessibilityRole="button"
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: selected ? colors.primary : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: selected ? colors.onPrimary : colors.text },
                      ]}
                    >
                      {categoryLabel(cat)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Split Configuration Card */}
          <Card>
            <SectionHeader title="Payment & Split Details" />

            {/* Paid By Tile */}
            <PickerTile
              icon="user"
              label="Paid By"
              value={paidBy === meId ? 'You' : nameOf(paidBy)}
              onPress={() => setSheet('payer')}
            />

            {/* Split Mode Tile */}
            <PickerTile
              icon="pie-chart"
              label="Split Mode"
              value={SPLIT_LABELS[splitType]}
              onPress={() => setSheet('split')}
            />

            {/* If Split Type is Specific */}
            {splitType === 'specific' ? (
              <PickerTile
                icon="users"
                label="Between"
                value={
                  participantIds.length === members.length
                    ? 'Everyone in group (' + members.length + ')'
                    : participantIds.length + (participantIds.length === 1 ? ' person' : ' people')
                }
                onPress={() => setSheet('participants')}
              />
            ) : null}

            {/* Paid With Tile */}
            <PickerTile
              icon="credit-card"
              label="Payment Method"
              value={paymentMode === 'upi' ? 'UPI' : 'Cash'}
              onPress={() => setSheet('payment')}
            />

            {/* Date Tile */}
            <TextField
              label="Expense Date"
              value={expenseDate}
              onChangeText={setExpenseDate}
              error={fieldErrors.expenseDate}
              placeholder="YYYY-MM-DD"
              leftIcon="calendar"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              editable={!submitting}
            />
          </Card>

          {/* Unequal Split Breakdown Card */}
          {unequal ? (
            <Card>
              <SectionHeader
                title={
                  splitType === 'exact'
                    ? 'Exact Amounts (₹)'
                    : splitType === 'percentage'
                      ? 'Percentages (%)'
                      : 'Relative Shares'
                }
              />
              <Text style={{ color: colors.muted, fontSize: typography.caption, marginBottom: spacing.sm }}>
                {splitType === 'exact'
                  ? 'Enter exact rupees per person. The sum must match total ₹' + (amount || '0') + '.'
                  : splitType === 'percentage'
                    ? 'Enter percentages. Total must equal 100%.'
                    : 'Enter share ratio weights (e.g. 2 for 2x share, 1 for normal).'}
              </Text>

              {members.map((member) => (
                <TextField
                  key={member.id}
                  label={member.id === meId ? member.fullName + ' (You)' : member.fullName}
                  value={splitValues[member.id] ?? ''}
                  onChangeText={(val) =>
                    setSplitValues((current) => ({ ...current, [member.id]: val }))
                  }
                  placeholder={splitType === 'shares' ? '1' : '0'}
                  keyboardType={splitType === 'shares' ? 'number-pad' : 'decimal-pad'}
                  inputMode={splitType === 'shares' ? 'numeric' : 'decimal'}
                  editable={!submitting}
                />
              ))}

              {splitProblem ? (
                <View style={[styles.warn, { backgroundColor: colors.subtle, borderColor: colors.destructive }]}>
                  <Icon name="alert-circle" size={16} tone="destructive" />
                  <Text style={{ color: colors.destructive, fontSize: typography.caption, flex: 1 }}>
                    {splitProblem}
                  </Text>
                </View>
              ) : (
                <View style={[styles.successNotice, { backgroundColor: colors.primarySubtle }]}>
                  <Icon name="check" size={16} tone="primary" />
                  <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '600' }}>
                    Shares add up correctly
                  </Text>
                </View>
              )}
            </Card>
          ) : null}

          {/* Notes and Receipt Card */}
          <Card>
            <SectionHeader title="Notes & Receipt" />
            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              error={fieldErrors.notes}
              placeholder="Any details or remarks..."
              leftIcon="file-text"
              multiline
              maxLength={500}
              editable={!submitting}
              style={styles.notes}
            />

            <ReceiptField
              url={receiptUrl}
              onChange={setReceiptUrl}
              folder="splitwise/receipts"
            />
          </Card>

          {/* Submission Error Banner */}
          {problem ? (
            <View style={[styles.warn, { backgroundColor: colors.subtle, borderColor: colors.destructive }]}>
              <Icon name="alert-circle" size={18} tone="destructive" />
              <View style={styles.warnTextContainer}>
                <Text style={{ color: colors.destructive, fontSize: typography.caption, fontWeight: '700' }}>
                  {problem.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
                  {problem.message}
                </Text>
              </View>
              {problem.retryable ? (
                <PrimaryButton
                  label="Retry"
                  variant="secondary"
                  loading={submitting}
                  onPress={() => void submit()}
                  style={styles.smallRetry}
                />
              ) : null}
            </View>
          ) : null}

          {/* Submit Button */}
          <PrimaryButton
            label={expense ? 'Update Expense' : 'Save Expense'}
            loading={submitting}
            disabled={!canSubmit}
            onPress={() => void submit()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers Sheets */}
      <Sheet visible={sheet === 'payer'} onClose={() => setSheet(null)} title="Who paid?">
        {members.map((member) => (
          <OptionRow
            key={member.id}
            label={member.id === meId ? member.fullName + ' (You)' : member.fullName}
            selected={paidBy === member.id}
            onPress={() => {
              setPaidBy(member.id);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={sheet === 'split'}
        onClose={() => setSheet(null)}
        title="Split Method"
        subtitle="The server calculates exact paise distribution."
      >
        {SPLIT_MODES.map((mode) => (
          <OptionRow
            key={mode}
            label={SPLIT_LABELS[mode]}
            detail={
              mode === 'everyone'
                ? 'Equally divided among all members'
                : mode === 'specific'
                  ? 'Equally divided among chosen members'
                  : mode === 'exact'
                    ? 'Enter exact rupees per person'
                    : mode === 'percentage'
                      ? 'Enter percentage share per person'
                      : 'Relative weights (e.g. 2 : 1 : 1)'
            }
            selected={splitType === mode}
            onPress={() => {
              setSplitType(mode);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'participants'} onClose={() => setSheet(null)} title="Select Participants">
        {members.map((member) => {
          const chosen = participantIds.includes(member.id);
          return (
            <OptionRow
              key={member.id}
              label={member.id === meId ? member.fullName + ' (You)' : member.fullName}
              selected={chosen}
              onPress={() =>
                setParticipantIds((current) =>
                  chosen ? current.filter((id) => id !== member.id) : [...current, member.id],
                )
              }
            />
          );
        })}
      </Sheet>

      <Sheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Select Category">
        <OptionRow
          label="Uncategorised"
          selected={category === null}
          onPress={() => {
            setCategory(null);
            setSheet(null);
          }}
        />
        {CATEGORIES.map((cat) => (
          <OptionRow
            key={cat}
            label={categoryLabel(cat)}
            selected={category === cat}
            onPress={() => {
              setCategory(cat);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'payment'} onClose={() => setSheet(null)} title="Payment Method">
        {(['cash', 'upi'] as PaymentMode[]).map((mode) => (
          <OptionRow
            key={mode}
            label={mode === 'upi' ? 'UPI' : 'Cash'}
            selected={paymentMode === mode}
            onPress={() => {
              setPaymentMode(mode);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>
    </SafeAreaView>
  );
}

/** Modern Picker Tile Component */
function PickerTile({
  icon,
  label,
  value,
  onPress,
}: {
  icon: 'user' | 'users' | 'pie-chart' | 'credit-card' | 'tag';
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + ': ' + value}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickerTile,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.pickerTileLeft}>
        <View style={[styles.iconCircle, { backgroundColor: colors.subtle }]}>
          <Icon name={icon} size={18} tone="primary" />
        </View>
        <View style={styles.pickerTileText}>
          <Text style={[styles.pickerLabel, { color: colors.muted }]}>{label}</Text>
          <Text style={[styles.pickerValue, { color: colors.text }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
      <Icon name="forward" size={16} tone="muted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  skeletonContainer: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
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
  amountHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  currencyPrefix: {
    fontSize: typography.hero,
    fontWeight: '800',
  },
  amountInput: {
    fontSize: typography.display,
    fontWeight: '900',
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  quickCategoryContainer: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  categoryPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  pickerTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  pickerTileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTileText: {
    flex: 1,
    gap: 2,
  },
  pickerLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerValue: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  notes: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  warnTextContainer: {
    flex: 1,
    gap: 2,
  },
  successNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  smallRetry: {
    minHeight: 32,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  errorText: {
    fontSize: typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});
