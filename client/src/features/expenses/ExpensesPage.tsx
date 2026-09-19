import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ApiClientError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupContext';
import { useRealtime } from '@/hooks/useRealtime';
import { deleteExpense, getGroup } from '@/lib/domainApi';
import { formatPaise } from '@/lib/money';
import { buildFilterQuery, countActiveFilters, DEFAULT_FILTERS, formatRelativeDate, resolveDatePreset } from '@/lib/dateRange';
import type { Expense, GroupMemberSummary, Pagination, ReportFilters } from '@/types/domain';
import { ImageViewer } from '@/components/ImageViewer';
import { AddExpenseDialog } from './AddExpenseDialog';
import { FilterDialog } from '@/features/dashboard/FilterDialog';

/**
 * Group expense ledger.
 *
 * Every filter is applied server-side using the same vocabulary as the dashboard, so
 * "Paid by me" means the same thing in both places. Filtering or paginating replaces
 * only this list -- the page chrome, the search box and the scroll position all stay put.
 */

const PAGE_SIZE = 15;

const CATEGORY_LABELS: Record<string, string> = {
  groceries: 'Groceries',
  food_dining: 'Food & Dining',
  rent: 'Rent',
  utilities: 'Utilities',
  entertainment: 'Entertainment',
  travel: 'Travel',
  household: 'Household',
  medical: 'Medical',
  other: 'Other',
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const ExpenseRowSkeleton: React.FC = () => (
  <li className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-28" />
    </div>
    <div className="space-y-1.5 text-right">
      <Skeleton className="ml-auto h-4 w-20" />
      <Skeleton className="ml-auto h-3 w-16" />
    </div>
  </li>
);

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const { activeGroup, activeGroupId } = useGroups();

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [receiptViewing, setReceiptViewing] = useState<Expense | null>(null);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => {
    const params = buildFilterQuery(filters);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));
    if (debouncedSearch) params.set('search', debouncedSearch);
    // Display-only keys the ledger endpoint does not accept.
    params.delete('rangeLabel');
    params.delete('preset');
    return params;
  }, [filters, page, debouncedSearch]);

  const fetchExpenses = useCallback(
    async (signal?: AbortSignal) => {
      if (!activeGroupId) return;

      // Existing rows stay on screen while revalidating, so filtering never blanks
      // the list or loses the reader's place.
      setIsRefreshing(true);
      setError(null);
      try {
        const data = await apiRequest<{ expenses: Expense[]; pagination: Pagination }>(
          `/api/groups/${activeGroupId}/expenses?${query}`,
          { signal },
        );
        if (signal?.aborted) return;
        setExpenses(data.expenses);
        setPagination(data.pagination);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        setError(
          err instanceof ApiClientError ? err.message : 'Could not load expenses.',
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [activeGroupId, query],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchExpenses(controller.signal);
    return () => controller.abort();
  }, [fetchExpenses]);

  // Members power the filter dialog and the Add/Edit form.
  useEffect(() => {
    if (!activeGroupId) return;
    let cancelled = false;
    void getGroup(activeGroupId)
      .then((data) => {
        if (!cancelled) setMembers(data.members);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeGroupId]);

  useRealtime(
    activeGroupId,
    useCallback(
      (payload) => {
        if (payload.event.startsWith('expense:')) void fetchExpenses();
      },
      [fetchExpenses],
    ),
  );

  const handleDelete = async () => {
    if (!deleting || !activeGroupId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteExpense(activeGroupId, deleting.id);
      toast.success('Expense deleted');
      setDeleting(null);
      void fetchExpenses();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'Could not delete the expense.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = countActiveFilters(filters) + (debouncedSearch ? 1 : 0);
  const rangeLabel = resolveDatePreset(filters.preset, {
    from: filters.from,
    to: filters.to,
  }).label;

  const memberRefs = members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    email: member.email,
    upiId: member.upiId,
    qrCodeUrl: member.qrCodeUrl,
  }));

  return (
    <AppShell
      title="Expenses"
      toolbar={
        <>
          {/* Add, then Filters, then any contextual menu: one order across every screen,
              so the primary action is always in the same place under the thumb. */}
          <Button onClick={() => setCreating(true)} className="h-11 flex-1 sm:flex-none">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Expense
          </Button>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(true)}
            className="h-11 shrink-0 px-3"
            aria-label="Filters"
          >
            <Filter className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline" aria-hidden>
              Filters
            </span>
            {activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        {/* ---- Search ---- */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or notes"
            className="pl-9 pr-10"
            aria-label="Search expenses"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ---- Active filter summary ---- */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="t-meta">{rangeLabel}</span>
          {pagination && (
            <span className="t-meta">
              · {pagination.total} {pagination.total === 1 ? 'expense' : 'expenses'}
            </span>
          )}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setSearch('');
                setPage(0);
              }}
              className="ml-auto font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ---- Ledger ---- */}
        <div
          className={cn(
            'overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-opacity',
            isRefreshing && !isLoading && 'opacity-70',
          )}
        >
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => void fetchExpenses()}
              >
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <ul>
              {[0, 1, 2, 3, 4].map((index) => (
                <ExpenseRowSkeleton key={index} />
              ))}
            </ul>
          ) : (expenses?.length ?? 0) === 0 ? (
            <div className="px-4 py-14 text-center">
              <Receipt className="mx-auto h-9 w-9 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold text-foreground/80">
                {activeCount > 0 ? 'No expenses match these filters' : 'No expenses yet'}
              </p>
              <p className="mx-auto mt-1 max-w-xs t-meta">
                {activeCount > 0
                  ? 'Try widening the date range or clearing a filter.'
                  : 'Add your first expense to start tracking who owes what.'}
              </p>
              {activeCount === 0 && (
                <Button className="mt-4" onClick={() => setCreating(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Expense
                </Button>
              )}
            </div>
          ) : (
            <ul>
              {expenses?.map((expense) => {
                const isMine = expense.paidBy === user?.id;
                return (
                  <li key={expense.id} className="border-t border-border first:border-t-0">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetail(expense)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            {initials(expense.payer?.fullName ?? '?')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {expense.title}
                          </p>
                          <p className="truncate t-meta">
                            {isMine ? 'You' : expense.payer?.fullName} ·{' '}
                            {formatRelativeDate(expense.expenseDate)} ·{' '}
                            {expense.participantCount} people
                            {expense.category && ` · ${CATEGORY_LABELS[expense.category]}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="t-money text-sm text-foreground">
                            {formatPaise(expense.amountPaise)}
                          </p>
                          <p
                            className={cn(
                              'text-xs',
                              expense.involvement === 'paid_by_me'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : expense.involvement === 'paid_by_others_for_me'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {expense.involvement === 'not_involved'
                              ? 'not involved'
                              : `your share ${formatPaise(expense.mySharePaise ?? 0)}`}
                          </p>
                        </div>
                      </button>

                      {/* Only the payer may edit or delete, matching the server rule. */}
                      {isMine && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(expense)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label={`Edit ${expense.title}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(expense)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-destructive"
                            aria-label={`Delete ${expense.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ---- Pagination ---- */}
          {pagination && pagination.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="t-meta">
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pagination.hasMore}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Dialogs ---- */}
      <FilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        members={memberRefs}
        onApply={(next) => {
          setFilters(next);
          setPage(0);
        }}
      />

      {activeGroup && (
        <>
          <AddExpenseDialog
            open={creating}
            onOpenChange={setCreating}
            groupId={activeGroup.id}
            members={memberRefs}
            currentUserId={user?.id ?? ''}
            onSaved={() => {
              toast.success('Expense added');
              void fetchExpenses();
            }}
          />

          <AddExpenseDialog
            open={Boolean(editing)}
            onOpenChange={(open) => !open && setEditing(null)}
            groupId={activeGroup.id}
            members={memberRefs}
            currentUserId={user?.id ?? ''}
            expense={editing}
            onSaved={() => {
              toast.success('Expense updated');
              setEditing(null);
              void fetchExpenses();
            }}
          />
        </>
      )}

      {/* Expense detail */}
      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent variant="sheet" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-xl bg-muted p-4 text-center">
              <p className="t-eyebrow">Total</p>
              <p className="t-money mt-1 text-2xl text-foreground">
                {formatPaise(detail?.amountPaise ?? 0)}
              </p>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Paid by</dt>
                <dd className="font-medium text-foreground">
                  {detail?.paidBy === user?.id ? 'You' : detail?.payer?.fullName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium text-foreground">{detail?.expenseDate}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Payment mode</dt>
                <dd className="font-medium text-foreground">
                  {detail?.paymentMode === 'upi' ? 'UPI / Online' : 'Cash'}
                </dd>
              </div>
              {detail?.category && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="font-medium text-foreground">
                    {CATEGORY_LABELS[detail.category]}
                  </dd>
                </div>
              )}
              {detail?.notes && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">Notes</dt>
                  <dd className="text-right font-medium text-foreground">{detail.notes}</dd>
                </div>
              )}
            </dl>

            {detail?.receiptUrl && (
              <button
                type="button"
                onClick={() => setReceiptViewing(detail)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-2 text-left transition-colors hover:bg-accent"
              >
                <img
                  src={detail.receiptUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">Receipt</span>
                  <span className="t-meta">Tap to view full size</span>
                </span>
              </button>
            )}

            <div>
              <p className="t-eyebrow mb-2">
                Split {detail?.participantCount} ways
                {detail?.splitType === 'exact' && ' · by exact amounts'}
                {detail?.splitType === 'percentage' && ' · by percentage'}
                {detail?.splitType === 'shares' && ' · by shares'}
              </p>
              <ul className="overflow-hidden rounded-xl border border-border">
                {detail?.participants.map((participant) => {
                  const member = members.find((m) => m.id === participant.userId);
                  return (
                    <li
                      key={participant.userId}
                      className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 first:border-t-0"
                    >
                      <span className="min-w-0 truncate text-sm text-foreground/80">
                        {participant.userId === user?.id
                          ? 'You'
                          : (member?.fullName ?? participant.fullName ?? 'Member')}
                      </span>
                      <span className="t-money shrink-0 text-sm text-foreground">
                        {formatPaise(participant.sharePaise)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageViewer
        open={Boolean(receiptViewing)}
        onOpenChange={(open) => !open && setReceiptViewing(null)}
        src={receiptViewing?.receiptUrl ?? null}
        title="Receipt"
        caption={receiptViewing?.title}
      />

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent variant="centered" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{deleting?.title}</span> (
              {formatPaise(deleting?.amountPaise ?? 0)}) will be removed and everyone&apos;s
              balances will be recalculated. This cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
