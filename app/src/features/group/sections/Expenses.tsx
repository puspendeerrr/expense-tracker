import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { expenses as expensesApi } from '@/api/endpoints';
import type { ExpenseFilters, ExpenseListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup } from '../GroupContext';
import { ExpenseCard } from '../cards';
import { CardSkeleton, OptionRow } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { CATEGORIES, categoryLabel } from '@/lib/money';

const PAGE = 20;

type FilterSheet = 'category' | 'payer' | 'involvement' | 'payment' | null;

const INVOLVEMENT: { value: NonNullable<ExpenseFilters['involvement']>; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'involving_me', label: 'Anything involving me' },
  { value: 'paid_by_me', label: 'I paid' },
  { value: 'paid_by_others_for_me', label: 'Someone paid for me' },
];

export function ExpensesSection() {
  const { colors } = useTheme();
  const { groupId, detail, revision } = useGroup();
  const router = useRouter();

  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [sheet, setSheet] = useState<FilterSheet>(null);

  const key = JSON.stringify({ ...filters, search });

  const request = useRequest<ExpenseListPayload>(
    useCallback(
      (signal: AbortSignal) =>
        expensesApi.list(
          groupId,
          { ...filters, ...(search.trim() ? { search: search.trim() } : {}), limit },
          signal,
        ),
      [groupId, key, limit],
    ),
    [groupId, key, limit, revision],
  );

  const rows = request.data?.expenses ?? [];
  const total = request.data?.pagination.total ?? 0;
  const hasMore = request.data?.pagination.hasMore ?? false;

  const memberName = (id?: string): string =>
    detail?.members.find((m) => m.id === id)?.fullName ?? 'Anyone';

  const chips = [
    filters.category && filters.category !== 'all' ? categoryLabel(filters.category) : null,
    filters.memberId ? memberName(filters.memberId) : null,
    filters.involvement && filters.involvement !== 'all'
      ? INVOLVEMENT.find((i) => i.value === filters.involvement)?.label
      : null,
    filters.paymentMode && filters.paymentMode !== 'all'
      ? filters.paymentMode === 'upi'
        ? 'UPI'
        : 'Cash'
      : null,
  ].filter(Boolean);

  const reset = (): void => {
    setFilters({});
    setSearch('');
    setLimit(PAGE);
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <PrimaryButton
          label="Add Expense"
          icon="add"
          variant="primary"
          onPress={() => router.push(('/group/' + groupId + '/expense/new') as never)}
          style={{ flex: 1.2 }}
        />
        <PrimaryButton
          label={chips.length > 0 ? `Filters (${chips.length})` : 'Filters'}
          icon="filter"
          variant="secondary"
          onPress={() => setSheet('category')}
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.searchWrap}>
        <TextField
          label="Search expenses"
          leftIcon="search"
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setLimit(PAGE);
          }}
          placeholder="Search by title or notes"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {chips.length > 0 ? (
        <View style={[styles.chipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chipsRow}>
            <Icon name="filter" size={14} tone="primary" />
            <Text style={{ color: colors.text, fontSize: typography.caption, fontWeight: '600', flex: 1 }}>
              {chips.join(' · ')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
              onPress={reset}
              hitSlop={8}
            >
              <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
                Clear
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {request.loading && !request.data ? (
        <CardSkeleton rows={5} />
      ) : request.error && !request.data ? (
        <ErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={chips.length > 0 || search ? 'No matching expenses' : 'No expenses recorded yet'}
          message={
            chips.length > 0 || search
              ? 'Try removing your search term or widening the filters.'
              : 'Keep track of shared spending by adding your first expense.'
          }
          icon="expense"
          action={
            chips.length > 0 || search
              ? { label: 'Clear filters', onPress: reset, variant: 'secondary' }
              : {
                  label: 'Add Expense',
                  onPress: () => router.push(('/group/' + groupId + '/expense/new') as never),
                  variant: 'primary',
                }
          }
        />
      ) : (
        <View style={styles.list}>
          {rows.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onPress={() => router.push(('/group/' + groupId + '/expense/' + expense.id) as never)}
            />
          ))}

          {hasMore ? (
            <PrimaryButton
              label={request.refreshing ? 'Loading…' : 'Load more'}
              variant="secondary"
              loading={request.refreshing}
              onPress={() => setLimit((value) => value + PAGE)}
              style={{ marginTop: spacing.sm }}
            />
          ) : (
            <Text style={[styles.end, { color: colors.muted }]}>
              {`Showing all ${total} ${total === 1 ? 'expense' : 'expenses'}`}
            </Text>
          )}
        </View>
      )}

      {/* ---- Filter Sheet ---- */}
      <Sheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title="Filter Expenses"
        subtitle={chips.length > 0 ? chips.join(' · ') : 'Showing all'}
        footer={
          <View style={{ gap: spacing.sm }}>
            <PrimaryButton label="Done" variant="primary" onPress={() => setSheet(null)} />
            <PrimaryButton
              label="Clear All"
              variant="secondary"
              onPress={() => {
                reset();
                setSheet(null);
              }}
            />
          </View>
        }
      >
        <FilterGroup title="Category">
          <OptionRow
            label="All categories"
            selected={!filters.category || filters.category === 'all'}
            onPress={() => {
              setFilters((f) => ({ ...f, category: 'all' }));
              setLimit(PAGE);
            }}
          />
          {CATEGORIES.map((category) => (
            <OptionRow
              key={category}
              label={categoryLabel(category)}
              selected={filters.category === category}
              onPress={() => {
                setFilters((f) => ({ ...f, category }));
                setLimit(PAGE);
              }}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Paid by">
          <OptionRow
            label="Anyone"
            selected={!filters.memberId}
            onPress={() => {
              setFilters((f) => ({ ...f, memberId: undefined }));
              setLimit(PAGE);
            }}
          />
          {detail?.members.map((member) => (
            <OptionRow
              key={member.id}
              label={member.fullName}
              selected={filters.memberId === member.id}
              onPress={() => {
                setFilters((f) => ({ ...f, memberId: member.id }));
                setLimit(PAGE);
              }}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Your involvement">
          {INVOLVEMENT.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              selected={(filters.involvement ?? 'all') === option.value}
              onPress={() => {
                setFilters((f) => ({ ...f, involvement: option.value }));
                setLimit(PAGE);
              }}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Payment method">
          <OptionRow
            label="All payment methods"
            selected={!filters.paymentMode || filters.paymentMode === 'all'}
            onPress={() => {
              setFilters((f) => ({ ...f, paymentMode: 'all' }));
              setLimit(PAGE);
            }}
          />
          <OptionRow
            label="UPI"
            selected={filters.paymentMode === 'upi'}
            onPress={() => {
              setFilters((f) => ({ ...f, paymentMode: 'upi' }));
              setLimit(PAGE);
            }}
          />
          <OptionRow
            label="Cash"
            selected={filters.paymentMode === 'cash'}
            onPress={() => {
              setFilters((f) => ({ ...f, paymentMode: 'cash' }));
              setLimit(PAGE);
            }}
          />
        </FilterGroup>
      </Sheet>
    </View>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.muted,
          fontSize: typography.xs,
          fontWeight: '800',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: spacing.xs,
        }}
      >
        {title}
      </Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.base },
  toolbar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  searchWrap: { marginTop: -spacing.xs },
  chipsCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  list: { gap: spacing.sm },
  end: {
    textAlign: 'center',
    fontSize: typography.caption,
    paddingVertical: spacing.md,
  },
  group: { gap: spacing.xs, marginBottom: spacing.md },
  groupBody: { gap: spacing.xs },
});
