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
import { countActiveFilters, DEFAULT_FILTERS, resolveDatePreset, formatRelativeDate } from '@/lib/dateRange';
import { downloadExport, remindMember } from '@/lib/domainApi';
import { formatPaise } from '@/lib/money';
import type { DueEntry, ReportFilters } from '@/types/domain';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardActions } from './DashboardActions';
import { BalanceHero } from './BalanceHero';
import { BalanceList } from './BalanceList';
import { PeriodStrip } from './PeriodStrip';
import { RelationshipSection } from './RelationshipSection';
import { SpendingAnalytics } from './SpendingAnalytics';
import { FilterDialog } from './FilterDialog';
import { ExportDialog, type ExportRequest } from './ExportDialog';
import { QuickActions } from './QuickActions';
import { InsightCards } from './InsightCards';
import { PeriodComparison } from './PeriodComparison';
import { DashboardCustomizer } from './DashboardCustomizer';
import {
  useDashboardPreferences,
  visibleWidgets,
  type WidgetId,
} from './useDashboardPreferences';
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
  <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="mt-2 bg-card">
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
  const {
    activeGroup,
    activeGroupId,
    status: groupStatus,
    hasGroups,
    error: groupsError,
    refreshGroups,
  } = useGroups();

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [groupBy, setGroupBy] = useState<ChartGrouping>('auto');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<DueEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [customiseOpen, setCustomiseOpen] = useState(false);

  const layout = useDashboardPreferences();
  const [breakdown, setBreakdown] = useState<'net' | 'owe' | 'owed' | null>(null);

  /**
   * Personal view reuses the existing `involvement` filter rather than adding a parallel
   * one: "only what involves me" is a question the reporting service already answers, and
   * a second mechanism for it would be a second thing to keep correct.
   */
  const effectiveFilters = useMemo<ReportFilters>(
    () =>
      layout.preferences?.view === 'personal'
        ? { ...filters, involvement: 'involving_me' }
        : filters,
    [filters, layout.preferences?.view],
  );

  const { live, analytics, chart, refresh, retry, applyRealtimeEvent } = useDashboardData(
    activeGroupId,
    effectiveFilters,
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

  /**
   * Runs an export the dialog has already composed.
   *
   * The dialog owns what goes into the file; this owns getting it onto disk. The
   * request is built there rather than from the dashboard's filters, so an export can
   * cover a different period and a different set of people than the screen behind it.
   */
  const handleExport = async (request: ExportRequest) => {
    if (!activeGroupId) return;
    setIsExporting(true);
    try {
      const { blob, filename } = await downloadExport(activeGroupId, request.params);
      // Object URL is revoked immediately after the click so the blob can be collected.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportOpen(false);
      toast.success('Report downloaded', { description: request.summary });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not generate the report.');
    } finally {
      setIsExporting(false);
    }
  };

  /* ---- Pre-dashboard states ---------------------------------------------- */

  /*
   * Four distinct outcomes, four distinct screens.
   *
   * The order matters more than any one branch. "Still loading" has to be checked
   * before "no groups", or the moment between signing in and the membership request
   * returning is rendered as an answer -- which is exactly the Create/Join flash this
   * replaces. "Failed to load" has to be separated from "no groups" too, or a dropped
   * request tells someone their groups are gone.
   */

  if (groupStatus === 'loading') {
    return (
      <AppShell title="Dashboard">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 sm:px-6">
          <Skeleton className="h-[168px] w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (groupStatus === 'error') {
    return (
      <AppShell title="Dashboard">
        <div className="flex min-h-[60dvh] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-4 text-xl font-bold text-foreground">
              Could not load your groups
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {groupsError ?? 'Something went wrong on the way to the server.'}
            </p>
            <Button className="mt-6 w-full" onClick={() => void refreshGroups()}>
              Try again
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!hasGroups) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h1 className="mt-4 text-xl font-bold text-foreground">No group yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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

  // Groups exist but the selection has not settled on one yet. Transient, and a
  // skeleton is the honest thing to show for it.
  if (!activeGroup) {
    return (
      <AppShell title="Dashboard">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 sm:px-6">
          <Skeleton className="h-[168px] w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppShell>
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
          onExport={() => setExportOpen(true)}
          onRefresh={() => refresh()}
          onCustomise={() => setCustomiseOpen(true)}
          mode={layout.preferences?.mode ?? 'detailed'}
          onModeChange={layout.setMode}
          view={layout.preferences?.view ?? 'group'}
          onViewChange={layout.setView}
        />
      }
    >

      {/*
        * 16px side gutter at every width, content capped for large screens.
        *
        * `space-y-4` rather than 6: at 24px between eight sections the page scrolled
        * past a screen and a half on a phone with almost nothing in it, which is what
        * made it feel empty and unfinished rather than airy.
        */}
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* Context strip: connection state and the billing cycle. Informational, so it
            sits with the content rather than competing for space in the topbar. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? 'animate-pulse-subtle bg-emerald-500' : 'bg-muted-foreground/40'
              }`}
            />
            <span className="t-meta">{isConnected ? 'Live updates on' : 'Reconnecting…'}</span>
          </span>

          {live.data?.billingCycle.payday && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {live.data.billingCycle.daysRemaining === 0
                  ? 'Payday is today'
                  : `Payday in ${live.data.billingCycle.daysRemaining} days`}
              </span>
            </span>
          )}
        </div>

        {live.error && <RegionError message={live.error} onRetry={() => retry('live')} />}

        {/*
          * Widgets render in the order the account chose, and only the ones it kept.
          *
          * A lookup keyed by id rather than a chain of conditionals: the order lives in
          * one array, so adding a widget means adding an entry here and one in the
          * server's registry, and nothing else moves.
          */}
        <div className="stagger-children space-y-4">
          {(() => {
            const nodes: Record<WidgetId, React.ReactNode> = {
              balance: (
                <BalanceHero
                  live={live.data}
                  isLoading={live.isLoading}
                  isRefreshing={live.isRefreshing}
                  onShowBreakdown={setBreakdown}
                />
              ),

              quickActions: (
                <QuickActions
                  onAddExpense={() => setAddExpenseOpen(true)}
                  onSearch={() => {
                    // The palette owns search; opening it is a keyboard event the shell
                    // already listens for, so we reuse that rather than lifting state.
                    window.dispatchEvent(
                      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }),
                    );
                  }}
                />
              ),

              insights: (
                <InsightCards
                  live={live.data}
                  analytics={analytics.data}
                  isLoading={analytics.isLoading || live.isLoading}
                />
              ),

              balanceList: (
                <BalanceList
                  live={live.data}
                  isLoading={live.isLoading}
                  onSettle={(entry) => setSettleTarget(entry)}
                  onRemind={(entry) => void handleRemind(entry)}
                />
              ),

              periodStrip: (
                <PeriodStrip
                  analytics={analytics.data}
                  isLoading={analytics.isLoading}
                  isRefreshing={analytics.isRefreshing}
                  rangeLabel={rangeLabel}
                />
              ),

              comparison: (
                <PeriodComparison
                  analytics={analytics.data}
                  isLoading={analytics.isLoading}
                />
              ),

              recentExpenses: (
                <section aria-labelledby="recent-heading" className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id="recent-heading" className="t-subtitle">
                      Recent expenses
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate('/app/expenses')}
                      className="rounded px-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      View all
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    {analytics.isLoading ? (
                      <div className="space-y-3 p-3.5">
                        {[0, 1, 2].map((index) => (
                          <Skeleton key={index} className="h-9 w-full" />
                        ))}
                      </div>
                    ) : (analytics.data?.recentExpenses.length ?? 0) === 0 ? (
                      <div className="px-4 py-12 text-center">
                        <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-white">
                          No expenses in this period
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Log a shared expense to see it here.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {analytics.data?.recentExpenses.map((expense) => (
                          <li key={expense.id}>
                            {/* Opens the expense it names. A row that shows a figure and
                                does nothing when pressed is the most common dead end in
                                a dashboard. */}
                            <button
                              type="button"
                              onClick={() => navigate(`/app/expenses?expense=${expense.id}`)}
                              aria-label={`${expense.title}, ${formatPaise(expense.amountPaise)}`}
                              className="row-interactive flex w-full items-center gap-3 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:bg-accent"
                            >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {expense.title}
                              </p>
                              <p className="truncate t-meta">
                                {expense.payerName} ·{' '}
                                {formatRelativeDate(expense.expenseDate)} ·{' '}
                                {expense.participantCount} people
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="t-money text-sm text-foreground">
                                {formatPaise(expense.amountPaise)}
                              </p>
                              <p className="t-meta">
                                your share {formatPaise(expense.mySharePaise)}
                              </p>
                            </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              ),

              relationships: analytics.error ? (
                <RegionError message={analytics.error} onRetry={() => retry('analytics')} />
              ) : (
                <RelationshipSection
                  relationships={relationships}
                  isLoading={analytics.isLoading || live.isLoading}
                  isRefreshing={analytics.isRefreshing}
                />
              ),

              analytics: (
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
              ),
            };

            return visibleWidgets(layout.preferences, layout.registry).map((id) => (
              <React.Fragment key={id}>{nodes[id]}</React.Fragment>
            ));
          })()}
        </div>
      </main>

      {/* ---- Dialogs ---- */}
      {layout.preferences && (
        <DashboardCustomizer
          open={customiseOpen}
          onOpenChange={setCustomiseOpen}
          preferences={layout.preferences}
          registry={layout.registry}
          onMove={layout.move}
          onMoveTo={layout.moveTo}
          onToggle={layout.toggle}
          onReset={layout.reset}
        />
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        members={members}
        filters={filters}
        isExporting={isExporting}
        onExport={(request) => void handleExport(request)}
      />

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
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center">
                  <p className="t-eyebrow">You owe</p>
                  <p className="t-money mt-0.5 text-lg text-red-700 dark:text-red-400">
                    {formatPaise(live.data?.balances.youNeedToPayTotal.paise ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                  <p className="t-eyebrow">You are owed</p>
                  <p className="t-money mt-0.5 text-lg text-emerald-700 dark:text-emerald-400">
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
                  <div className="rounded-xl border border-white/[0.08] bg-[#111827]/60 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-white">
                      All settled up
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Nothing outstanding in this category.
                    </p>
                  </div>
                );
              }

              const owedIds = new Set((live.data?.peopleWhoOweMe ?? []).map((e) => e.user.id));

              return (
                <ul className="overflow-hidden rounded-xl border border-border">
                  {entries.map((entry) => {
                    const theyOweMe = breakdown === 'owed' || (breakdown === 'net' && owedIds.has(entry.user.id));
                    return (
                      <li
                        key={`${entry.user.id}-${theyOweMe ? 'in' : 'out'}`}
                        className="flex items-center justify-between gap-3 border-t border-border px-3 py-3 first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {entry.user.fullName}
                          </p>
                          <p className="t-meta">{theyOweMe ? 'owes you' : 'you owe'}</p>
                        </div>
                        <span
                          className={`t-money shrink-0 text-sm ${
                            theyOweMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
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
