import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { expenses as expensesApi } from '@/api/endpoints';
import type { Expense, ExpenseFilters, ExpenseListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useAuth } from '@/auth/AuthProvider';
import { useGroup } from '../GroupContext';
import { describeExpenseRow } from '../expenseRow';
import { groupByDay } from '../ledger';
import { canModifyExpense } from '../permissions';
import {
  SMActionSheet,
  SMButton,
  SMConfirmSheet,
  SMDateHeader,
  SMEmptyState,
  SMErrorState,
  SMExpenseFilterSheet,
  SMExpenseListItem,
  SMFilterChip,
  SMRowSkeleton,
  SMSearchInput,
  type SMFilterGroup,
} from '@/components/sm';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { CATEGORIES, categoryLabel } from '@/lib/money';
import { describeError } from '@/api/errors';

const PAGE = 20;

/** How long to let someone keep typing before asking the server. */
const SEARCH_DEBOUNCE_MS = 300;

const INVOLVEMENT_LABELS: Record<string, string> = {
  involving_me: 'Involves me',
  paid_by_me: 'I paid',
  paid_by_others_for_me: 'Paid for me',
};

/**
 * The filter facets, built from what the server actually accepts.
 *
 * `paidBy` is used for "Paid by", NOT `memberId`. The server treats `memberId` as "paid for
 * it OR was a participant in it", so the previous screen's "Paid by: Rahul" also returned
 * expenses Rahul merely shared in — a filter that quietly answered a different question
 * than its label asked. `paidBy` matches `e.paid_by` alone, which is what the label means.
 */
function buildFilterGroups(members: { id: string; fullName: string }[]): SMFilterGroup[] {
  return [
    {
      key: 'category',
      title: 'Category',
      options: [
        { value: undefined, label: 'All categories' },
        ...CATEGORIES.map((category) => ({
          value: category as string,
          label: categoryLabel(category),
        })),
      ],
    },
    {
      key: 'paidBy',
      title: 'Paid by',
      options: [
        { value: undefined, label: 'Anyone' },
        ...members.map((member) => ({ value: member.id, label: member.fullName })),
      ],
    },
    {
      key: 'involvement',
      title: 'Your involvement',
      options: [
        { value: undefined, label: 'Everything' },
        { value: 'involving_me', label: 'Anything involving me' },
        { value: 'paid_by_me', label: 'I paid' },
        { value: 'paid_by_others_for_me', label: 'Someone paid for me' },
      ],
    },
    {
      key: 'paymentMode',
      title: 'Payment method',
      options: [
        { value: undefined, label: 'All methods' },
        { value: 'upi', label: 'UPI' },
        { value: 'cash', label: 'Cash' },
      ],
    },
  ];
}

/** The subset of ExpenseFilters this screen drives, as plain strings the sheet can edit. */
type LedgerFilters = {
  category?: string;
  paidBy?: string;
  involvement?: string;
  paymentMode?: string;
};

export function ExpensesSection() {
  const { colors, dark } = useTheme();
  const { groupId, detail, revision, refresh: refreshGroup } = useGroup();
  const { user } = useAuth();
  const router = useRouter();

  const [filters, setFilters] = useState<LedgerFilters>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [filterSheet, setFilterSheet] = useState(false);

  const [actionFor, setActionFor] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /*
   * Search is a SERVER query (ilike over title and notes), so it is debounced. Typing
   * "dinner" previously fired six requests, each of which could land out of order; now it
   * fires one. The timer is cleared on every keystroke and on unmount, and `useRequest`
   * aborts whatever is still in flight when the query changes, so a slow earlier reply
   * cannot overwrite a newer one.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setLimit(PAGE);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  const query: ExpenseFilters = useMemo(
    () => ({
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.paidBy ? { paidBy: filters.paidBy } : {}),
      ...(filters.involvement
        ? { involvement: filters.involvement as ExpenseFilters['involvement'] }
        : {}),
      ...(filters.paymentMode
        ? { paymentMode: filters.paymentMode as ExpenseFilters['paymentMode'] }
        : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      limit,
    }),
    [filters, debouncedSearch, limit],
  );

  const key = JSON.stringify(query);

  const request = useRequest<ExpenseListPayload>(
    useCallback((signal: AbortSignal) => expensesApi.list(groupId, query, signal), [groupId, key]),
    // `revision` ticks when a realtime expense event arrives, which refetches this list
    // from the server with the CURRENT filters and search still applied.
    [groupId, key, revision],
  );

  const rows = request.data?.expenses ?? [];
  const total = request.data?.pagination.total ?? 0;
  const hasMore = request.data?.pagination.hasMore ?? false;

  const days = useMemo(() => groupByDay(rows, (expense) => expense.expenseDate), [rows]);

  const memberName = (id: string): string =>
    detail?.members.find((member) => member.id === id)?.fullName ?? 'Someone';

  /** The active filters, as chips that can each be lifted on their own. */
  const activeChips = [
    filters.category
      ? { key: 'category', label: categoryLabel(filters.category), icon: 'tag' as const }
      : null,
    filters.paidBy
      ? { key: 'paidBy', label: memberName(filters.paidBy) + ' paid', icon: 'person' as const }
      : null,
    filters.involvement
      ? {
          key: 'involvement',
          label: INVOLVEMENT_LABELS[filters.involvement] ?? filters.involvement,
          icon: 'user' as const,
        }
      : null,
    filters.paymentMode
      ? {
          key: 'paymentMode',
          label: filters.paymentMode === 'upi' ? 'UPI' : 'Cash',
          icon: 'money' as const,
        }
      : null,
  ].filter((chip): chip is { key: string; label: string; icon: 'tag' | 'person' | 'user' | 'money' } =>
    chip !== null,
  );

  const filtered = activeChips.length > 0;
  const searching = debouncedSearch.length > 0;

  const resetFilters = (): void => {
    setFilters({});
    setLimit(PAGE);
  };

  const clearEverything = (): void => {
    setFilters({});
    setSearch('');
    setLimit(PAGE);
  };

  /* ---- Row actions, only where the server would allow them ---- */


  const doDelete = async (): Promise<void> => {
    const target = confirmDelete;
    if (!target || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await expensesApi.remove(groupId, target.id);
      setConfirmDelete(null);
      // Balances move when an expense goes, and only the server knows the new ones.
      await Promise.all([request.refresh(), refreshGroup()]);
    } catch (caught: unknown) {
      setDeleteError(describeError(caught).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/*
       * NO "ADD EXPENSE" BUTTON HERE, DELIBERATELY.
       *
       * This section renders inside Group Detail, whose own full-width "Add expense"
       * button sits a little way up the same scroll view. Repeating it here put two
       * identical primary buttons on one screen, which makes the reader stop and work out
       * whether they do different things. The empty state below still offers the action,
       * because that is the one case where the screen has nothing else to say.
       *
       * A floating button is not the alternative: the AI assistant already owns the
       * bottom-right corner, and an ad banner can occupy the bottom edge.
       */}
      {/* ---- Search, with filters beside it ---- */}
      <View style={styles.toolbar}>
        <SMSearchInput
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search expenses…"
          style={styles.search}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            filtered
              ? 'Filters, ' + activeChips.length + ' active'
              : 'Filter expenses'
          }
          onPress={() => setFilterSheet(true)}
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: filtered
                ? colors.primarySubtle ?? colors.subtle
                : colors.surface,
              borderColor: filtered
                ? colors.primary
                : dark
                  ? colors.borderStrong
                  : colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Icon name="filter" size={18} color={filtered ? colors.primary : colors.muted} />
          {filtered ? (
            <View style={[styles.filterCount, { backgroundColor: colors.primary }]}>
              <Text style={[styles.filterCountText, { color: colors.onPrimary ?? '#FFFFFF' }]}>
                {activeChips.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* ---- What is currently narrowing the list ---- */}
      {filtered ? (
        <View style={styles.chips}>
          {activeChips.map((chip) => (
            <SMFilterChip
              key={chip.key}
              label={chip.label}
              icon={chip.icon}
              onPress={() => setFilterSheet(true)}
              onRemove={() => {
                setFilters((current) => ({ ...current, [chip.key]: undefined }));
                setLimit(PAGE);
              }}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
            onPress={resetFilters}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[styles.reset, { color: colors.primary }]}>Reset</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ---- The ledger ---- */}
      {request.loading && !request.data ? (
        <SMRowSkeleton rows={5} />
      ) : request.error && !request.data ? (
        <SMErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : rows.length === 0 ? (
        /*
         * Three different nothings, which must not be confused. An empty group is a
         * prompt to add the first expense; an empty search or filter is a prompt to widen
         * the question, and saying "no expenses yet" there would be a lie about the data.
         */
        searching ? (
          <SMEmptyState
            icon="search"
            title="No expenses match your search"
            description={'Nothing in this group matches “' + debouncedSearch + '”.'}
            primaryAction={{ label: 'Clear search', onPress: () => setSearch('') }}
          />
        ) : filtered ? (
          <SMEmptyState
            icon="filter"
            title="No expenses match these filters"
            description="There are expenses in this group, but none fit the filters you have on."
            primaryAction={{ label: 'Reset filters', onPress: resetFilters }}
          />
        ) : (
          <SMEmptyState
            icon="expense"
            title="No expenses yet"
            description="Add the first expense to start tracking shared spending in this group."
            primaryAction={{
              label: 'Add expense',
              icon: 'add',
              onPress: () => router.push(('/group/' + groupId + '/expense/new') as never),
            }}
          />
        )
      ) : (
        <View style={styles.list}>
          {days.map((day) => (
            <View key={day.label} style={styles.day}>
              <SMDateHeader label={day.label} />

              <View style={styles.dayRows}>
                {day.rows.map((expense) => (
                  <SMExpenseListItem
                    key={expense.id}
                    {...describeExpenseRow(expense)}
                    // The date header above the group already says which day this is.
                    dateLabel={undefined}
                    onPress={() =>
                      router.push(('/group/' + groupId + '/expense/' + expense.id) as never)
                    }
                    onLongPress={canModifyExpense(expense, user?.id) ? () => setActionFor(expense) : undefined}
                  />
                ))}
              </View>
            </View>
          ))}

          {hasMore ? (
            <SMButton
              label={request.refreshing ? 'Loading…' : 'Load more'}
              variant="secondary"
              loading={request.refreshing}
              onPress={() => setLimit((value) => value + PAGE)}
              style={styles.loadMore}
              accessibilityHint={'Showing ' + rows.length + ' of ' + total}
            />
          ) : (
            <Text style={[styles.end, { color: colors.muted }]}>
              {searching || filtered
                ? 'Showing ' + total + (total === 1 ? ' match' : ' matches')
                : 'Showing all ' + total + (total === 1 ? ' expense' : ' expenses')}
            </Text>
          )}
        </View>
      )}

      {/* ---- Sheets ---- */}

      <SMExpenseFilterSheet
        visible={filterSheet}
        onClose={() => setFilterSheet(false)}
        groups={buildFilterGroups(detail?.members ?? [])}
        value={filters}
        onApply={(next) => {
          setFilters(next);
          setLimit(PAGE);
        }}
        onReset={clearEverything}
      />

      <SMActionSheet
        visible={actionFor !== null}
        onClose={() => setActionFor(null)}
        title={actionFor?.title ?? 'Expense'}
        subtitle="Expense actions"
        actions={[
          {
            id: 'edit',
            label: 'Edit expense',
            description: 'Change the amount, split or details',
            icon: 'edit',
            onPress: () => {
              if (actionFor) {
                router.push(
                  ('/group/' + groupId + '/expense/' + actionFor.id + '/edit') as never,
                );
              }
            },
          },
          {
            id: 'delete',
            label: 'Delete expense',
            icon: 'trash',
            destructive: true,
            onPress: () => setConfirmDelete(actionFor),
          },
        ]}
      />

      <SMConfirmSheet
        visible={confirmDelete !== null}
        onCancel={() => {
          setConfirmDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void doDelete()}
        destructive
        loading={deleting}
        icon="trash"
        title="Delete this expense?"
        description={
          confirmDelete
            ? '“' + confirmDelete.title + '” will be removed from this group for everyone.'
            : ''
        }
        detail={
          confirmDelete
            ? 'The expense is deleted outright, not archived, and this cannot be undone. Balances for everyone who shared it will be recalculated by the server.'
            : undefined
        }
        errorMessage={deleteError}
        confirmLabel="Delete expense"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.base },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  search: { flex: 1 },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A count, not a warning: it sits in the brand colour on the control it belongs to.
  filterCount: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterCountText: { fontSize: 10, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  reset: { fontSize: typography.xs, fontWeight: '700', paddingHorizontal: spacing.xs },
  list: { gap: spacing.xs },
  day: { gap: spacing.xs },
  dayRows: { gap: spacing.sm },
  loadMore: { marginTop: spacing.sm },
  end: {
    textAlign: 'center',
    fontSize: typography.caption,
    paddingVertical: spacing.md,
  },
});
