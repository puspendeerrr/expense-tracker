import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, CalendarClock, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupContext';
import { useDashboardData, type ChartGrouping } from '@/hooks/useDashboardData';
import { useRealtime } from '@/hooks/useRealtime';
import { buildFilterQuery, countActiveFilters, DEFAULT_FILTERS, resolveDatePreset, formatRelativeDate } from '@/lib/dateRange';
import { downloadExport, remindMember } from '@/lib/domainApi';
import { formatPaise } from '@/lib/money';
import type { DueEntry, ReportFilters } from '@/types/domain';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardActions } from './DashboardActions';
import { FinancialSummary } from './FinancialSummary';
import { WhoOwesWhom } from './WhoOwesWhom';
import { RelationshipSection } from './RelationshipSection';
import { SpendingAnalytics } from './SpendingAnalytics';
import { FilterDialog } from './FilterDialog';
import { AddExpenseDialog } from '@/features/expenses/AddExpenseDialog';
import { SettleDialog } from '@/features/settlements/SettleDialog';

/**
 * Dashboard.
 *
 * Composed of independent regions (see `useDashboardData`). Nothing here reloads the
 * page or clears global state: applying a filter refetches analytics and chart only,
 * changing the chart grouping refetches the chart only, and paginating a list is local
 * state. Balances never move because a date filter changed.
 */

const RegionError: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-amber-900">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="mt-2 bg-white">
        Retry
      </Button>
    </div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Group switching now lives in the shell's sidebar, so this page only needs the
  // active group.
  const { activeGroup, activeGroupId, isLoading: groupsLoading } = useGroups();

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [groupBy, setGroupBy] = useState<ChartGrouping>('auto');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<DueEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [breakdown, setBreakdown] = useState<'net' | 'owe' | 'owed' | null>(null);

  const { live, analytics, chart, refresh, retry, applyRealtimeEvent } = useDashboardData(
    activeGroupId,
    filters,
    groupBy,
  );

  const { isConnected } = useRealtime(
    activeGroupId,
    applyRealtimeEvent,
    // On reconnect, resynchronise everything: state may have moved on while away.
    useCallback(() => refresh(), [refresh]),
  );

  const rangeLabel = useMemo(
    () => resolveDatePreset(filters.preset, { from: filters.from, to: filters.to }).label,
    [filters],
  );

  /**
   * Joins period attribution (analytics) to live obligations (live).
   *
   * The two halves arrive from different regions on purpose -- attribution moves with
   * the date filter, obligations never do -- so they are composed here rather than
   * being blended server-side into one filtered figure. This is a join of two
   * server-computed values, not a re-derivation of anything financial.
   *
   * Someone with a live debt but no activity in the window still has to appear, or the
   * relationship table would hide money that is genuinely owed.
   */
  const relationships = useMemo(() => {
    const attribution = analytics.data?.relationships ?? [];
    const iOwe = new Map(live.data?.peopleIOwe.map((due) => [due.user.id, due]) ?? []);
    const theyOwe = new Map(live.data?.peopleWhoOweMe.map((due) => [due.user.id, due]) ?? []);

    const zero = { paise: 0, rupees: 0 };
    const merged = attribution.map((row) => ({
      ...row,
      iCurrentlyOwe: iOwe.get(row.person.id)
        ? { paise: iOwe.get(row.person.id)!.amountPaise, rupees: iOwe.get(row.person.id)!.amount }
        : zero,
      theyCurrentlyOwe: theyOwe.get(row.person.id)
        ? {
            paise: theyOwe.get(row.person.id)!.amountPaise,
            rupees: theyOwe.get(row.person.id)!.amount,
          }
        : zero,
    }));

    const known = new Set(merged.map((row) => row.person.id));
    for (const due of [...iOwe.values(), ...theyOwe.values()]) {
      if (known.has(due.user.id)) continue;
      merged.push({
        person: due.user,
        isStillMember: true,
        iPaidForThem: zero,
        theyPaidForMe: zero,
        relatedExpenseCount: 0,
        lastRelatedExpenseDate: null,
        iCurrentlyOwe: iOwe.has(due.user.id)
          ? { paise: due.amountPaise, rupees: due.amount }
          : zero,
        theyCurrentlyOwe: theyOwe.has(due.user.id)
          ? { paise: due.amountPaise, rupees: due.amount }
          : zero,
      });
    }

    // Live obligations first, then by how much history we share.
    return merged.sort((a, b) => {
      const aLive = a.iCurrentlyOwe.paise + a.theyCurrentlyOwe.paise;
      const bLive = b.iCurrentlyOwe.paise + b.theyCurrentlyOwe.paise;
      if (aLive !== bLive) return bLive - aLive;
      return (
        b.iPaidForThem.paise + b.theyPaidForMe.paise -
        (a.iPaidForThem.paise + a.theyPaidForMe.paise)
      );
    });
  }, [analytics.data, live.data]);

  const handleRemind = async (entry: DueEntry) => {
    if (!activeGroupId) return;
    try {
      const result = await remindMember(activeGroupId, entry.user.id);
      toast.success(`Reminder sent to ${entry.user.fullName}`, {
        description: `They were told you are waiting for ${result.amount}.`,
      });
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Could not send that reminder.',
      );
    }
  };

  const handleExport = async () => {
    if (!activeGroupId) return;
    setIsExporting(true);
    try {
      const { blob, filename } = await downloadExport(activeGroupId, buildFilterQuery(filters));
      // Object URL is revoked immediately after the click so the blob can be collected.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not generate the report.');
    } finally {
      setIsExporting(false);
    }
  };

  /* ---- Empty states ---- */

  if (groupsLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Receipt className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">No group yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Create a group for your flat or trip, or join one with an invite code.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => navigate('/app/groups/new')}>Create a group</Button>
            <Button variant="outline" onClick={() => navigate('/app/groups/join')}>
              Join with a code
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const members = live.data?.members ?? [];

  return (
    <AppShell
      title="Dashboard"
      toolbar={
        <DashboardActions
          isRefreshing={live.isRefreshing}
          activeFilterCount={countActiveFilters(filters)}
          isExporting={isExporting}
          onAddExpense={() => setAddExpenseOpen(true)}
          onOpenFilters={() => setFiltersOpen(true)}
          onExport={handleExport}
          onRefresh={() => refresh()}
        />
      }
    >

      {/* 16px side gutter at every width; content capped for large screens. */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* Context strip: connection state and the billing cycle. Informational, so it
            sits with the content rather than competing for space in the topbar. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? 'animate-pulse-subtle bg-emerald-500' : 'bg-slate-300'
              }`}
            />
            <span className="t-meta">{isConnected ? 'Live updates on' : 'Reconnecting…'}</span>
          </span>

          {live.data?.billingCycle.payday && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
              <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-600">
                {live.data.billingCycle.daysRemaining === 0
                  ? 'Payday is today'
                  : `Payday in ${live.data.billingCycle.daysRemaining} days`}
              </span>
            </span>
          )}

          <span className="t-meta ml-auto truncate">{rangeLabel}</span>
        </div>

        {live.error && <RegionError message={live.error} onRetry={() => retry('live')} />}

        <FinancialSummary
          live={live.data}
          analytics={analytics.data}
          liveLoading={live.isLoading}
          liveRefreshing={live.isRefreshing}
          analyticsLoading={analytics.isLoading}
          analyticsRefreshing={analytics.isRefreshing}
          rangeLabel={rangeLabel}
          onShowBreakdown={setBreakdown}
        />

        <WhoOwesWhom
          live={live.data}
          isLoading={live.isLoading}
          onSettle={(entry) => setSettleTarget(entry)}
          onRemind={(entry) => void handleRemind(entry)}
        />

        {analytics.error ? (
          <RegionError message={analytics.error} onRetry={() => retry('analytics')} />
        ) : (
          <RelationshipSection
            relationships={relationships}
            isLoading={analytics.isLoading || live.isLoading}
            isRefreshing={analytics.isRefreshing}
          />
        )}

        <SpendingAnalytics
          chart={chart.data}
          analytics={analytics.data}
          chartLoading={chart.isLoading}
          chartRefreshing={chart.isRefreshing}
          chartError={chart.error}
          analyticsLoading={analytics.isLoading}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          onRetryChart={() => retry('chart')}
        />

        {/* ---- Recent expenses ---- */}
        <section aria-labelledby="recent-heading" className="space-y-3">
          <h2
            id="recent-heading"
            className="flex items-center gap-2 text-sm font-bold text-slate-900"
          >
            <Receipt className="h-4 w-4 text-slate-400" />
            Recent expenses
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {analytics.isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (analytics.data?.recentExpenses.length ?? 0) === 0 ? (
              <p className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                No expenses in this period.
              </p>
            ) : (
              <ul>
                {analytics.data?.recentExpenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {expense.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {expense.payerName} · {formatRelativeDate(expense.expenseDate)} ·{' '}
                        {expense.participantCount} people
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-bold tabular-nums text-slate-900">
                        {formatPaise(expense.amountPaise)}
                      </p>
                      <p className="text-xs text-slate-500">
                        your share {formatPaise(expense.mySharePaise)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      {/* ---- Dialogs ---- */}
      <FilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        members={members}
        onApply={setFilters}
      />

      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        groupId={activeGroup.id}
        members={members}
        currentUserId={user?.id ?? ''}
        onSaved={() => {
          toast.success('Expense added');
          // Realtime will also fire, but refreshing here makes the author's own view
          // update immediately rather than after the socket round trip.
          refresh(['live', 'analytics', 'chart']);
        }}
      />

      <SettleDialog
        open={Boolean(settleTarget)}
        onOpenChange={(open) => !open && setSettleTarget(null)}
        groupId={activeGroup.id}
        groupName={activeGroup.name}
        counterpart={settleTarget?.user ?? null}
        onSettled={() => {
          toast.success('Payment recorded — waiting for confirmation');
          refresh(['live']);
        }}
      />
      {/* Card breakdown: who makes up the figure on the card that was tapped. */}
      <Dialog open={Boolean(breakdown)} onOpenChange={(open) => !open && setBreakdown(null)}>
        <DialogContent variant="sheet" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {breakdown === 'owe'
                ? 'People you owe'
                : breakdown === 'owed'
                  ? 'People who owe you'
                  : 'Your net position'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {breakdown === 'net' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-center">
                  <p className="t-eyebrow">You owe</p>
                  <p className="t-money mt-0.5 text-lg text-red-700">
                    {formatPaise(live.data?.balances.youNeedToPayTotal.paise ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                  <p className="t-eyebrow">You are owed</p>
                  <p className="t-money mt-0.5 text-lg text-emerald-700">
                    {formatPaise(live.data?.balances.youWillReceiveTotal.paise ?? 0)}
                  </p>
                </div>
              </div>
            )}

            {(() => {
              const entries =
                breakdown === 'owe'
                  ? (live.data?.peopleIOwe ?? [])
                  : breakdown === 'owed'
                    ? (live.data?.peopleWhoOweMe ?? [])
                    : [
                        ...(live.data?.peopleIOwe ?? []),
                        ...(live.data?.peopleWhoOweMe ?? []),
                      ];

              if (entries.length === 0) {
                return (
                  <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                    Nothing outstanding.
                  </p>
                );
              }

              const owedIds = new Set((live.data?.peopleWhoOweMe ?? []).map((e) => e.user.id));

              return (
                <ul className="overflow-hidden rounded-xl border border-slate-200">
                  {entries.map((entry) => {
                    const theyOweMe = breakdown === 'owed' || (breakdown === 'net' && owedIds.has(entry.user.id));
                    return (
                      <li
                        key={`${entry.user.id}-${theyOweMe ? 'in' : 'out'}`}
                        className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-3 first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {entry.user.fullName}
                          </p>
                          <p className="t-meta">{theyOweMe ? 'owes you' : 'you owe'}</p>
                        </div>
                        <span
                          className={`t-money shrink-0 text-sm ${
                            theyOweMe ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatPaise(entry.amountPaise)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}

            <p className="t-meta">
              These figures cover all time and are not affected by the dashboard date filter.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBreakdown(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
