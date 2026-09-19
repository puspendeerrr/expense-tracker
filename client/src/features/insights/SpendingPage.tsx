import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Lock, TrendingUp, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getSpendingReport, type SpendingReport } from '@/lib/domainApi';
import { formatPaise, formatPaiseCompact } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/dateRange';

/**
 * Person-wise spending dashboard.
 *
 * A separate surface from the group dashboard, and a different question. The group
 * dashboard answers "what do I owe, and to whom?"; this answers "where is the money
 * going, per person, across the groups I have been given sight of".
 *
 * It shows attribution (each person's share of expenses), never balances. Those live in
 * the balance engine and are pairwise and directional, and putting a second, netted
 * version of them on a reporting screen is how two parts of an app start disagreeing
 * about money.
 *
 * Access is granted per account by an administrator, and the scope of what it covers is
 * set with the grant. If the scope resolves to nothing, this renders an explanation
 * rather than an empty chart.
 */

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
] as const;

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

const monthLabel = (month: string): string => {
  const [year, index] = month.split('-');
  const date = new Date(Number(year), Number(index) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

export const SpendingPage: React.FC = () => {
  const { can, user } = useAuth();

  const [range, setRange] = useState<string>('90');
  const [groupId, setGroupId] = useState<string>('all');
  const [report, setReport] = useState<SpendingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const params: { from?: string; to?: string; groupId?: string } = {};
        if (range !== 'all') {
          params.from = toLocalIsoDate(new Date(Date.now() - Number(range) * 86_400_000));
          params.to = toLocalIsoDate(new Date());
        }
        if (groupId !== 'all') params.groupId = groupId;

        setReport(await getSpendingReport(params, signal));
      } catch (err: unknown) {
        if (signal?.aborted) return;
        setError(
          err instanceof ApiClientError ? err.message : 'Could not load spending data.',
        );
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [range, groupId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Bar widths are relative to the biggest row, so small values stay visible. */
  const maxSpent = useMemo(
    () => Math.max(1, ...(report?.people ?? []).map((person) => person.spentPaise)),
    [report],
  );
  const maxMonth = useMemo(
    () => Math.max(1, ...(report?.months ?? []).map((month) => month.spentPaise)),
    [report],
  );

  if (!can('dashboard.spending')) {
    return (
      <AppShell title="Spending">
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h2 className="mt-4 t-title">You do not have access to this dashboard</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            The spending dashboard is granted per account by an administrator. Ask one to
            enable it for you.
          </p>
        </div>
      </AppShell>
    );
  }

  const noScope = report !== null && report.scope.kind === 'none';

  return (
    <AppShell title="Spending">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        {/* ---- Filters ---- */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-11 w-auto min-w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(report?.groups.length ?? 0) > 1 && (
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="h-11 w-auto min-w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups in scope</SelectItem>
                {report?.groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : noScope ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
            <Lock className="mx-auto h-9 w-9 text-muted-foreground/60" />
            <h2 className="mt-3 t-subtitle">No groups are in scope yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              You have been given the spending dashboard, but an administrator has not
              chosen which groups it should cover. Ask them to set its scope.
            </p>
          </div>
        ) : (
          <>
            {/* ---- Totals ---- */}
            <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Total spend',
                  value: formatPaiseCompact(report!.totals.spentPaise),
                  icon: TrendingUp,
                },
                { label: 'Expenses', value: String(report!.totals.expenseCount), icon: BarChart3 },
                { label: 'People', value: String(report!.totals.personCount), icon: Users },
                { label: 'Groups', value: String(report!.totals.groupCount), icon: Users },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"
                >
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 font-mono text-lg font-bold tabular-nums text-foreground">
                    {card.value}
                  </p>
                  <p className="t-meta">{card.label}</p>
                </div>
              ))}
            </div>

            {/* ---- Per person ---- */}
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-muted/60 px-4 py-3">
                <h2 className="t-subtitle">Spending per person</h2>
                <p className="t-meta">
                  Their share of expenses, and what they paid out of pocket.
                </p>
              </div>

              {report!.people.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No expenses in this period.
                </p>
              ) : (
                <ul className="stagger-children">
                  {report!.people.map((person, index) => (
                    <li
                      key={person.userId}
                      className={cn(
                        'px-4 py-3',
                        index > 0 && 'border-t border-border',
                        person.userId === user?.id && 'bg-primary/[0.03]',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-[11px]">
                            {initials(person.fullName)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {person.userId === user?.id ? 'You' : person.fullName}
                          </p>
                          <p className="t-meta">
                            {person.expenseCount} expenses &middot; paid{' '}
                            {formatPaise(person.paidPaise)}
                          </p>
                        </div>

                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatPaise(person.spentPaise)}
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{
                            width: `${Math.max(2, (person.spentPaise / maxSpent) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ---- By category ---- */}
              <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border bg-muted/60 px-4 py-3">
                  <h2 className="t-subtitle">By category</h2>
                </div>
                {report!.categories.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing to show.
                  </p>
                ) : (
                  <ul>
                    {report!.categories.map((row, index) => (
                      <li
                        key={row.category ?? 'uncategorised'}
                        className={cn(
                          'flex items-center justify-between gap-3 px-4 py-2.5',
                          index > 0 && 'border-t border-border',
                        )}
                      >
                        <span className="min-w-0 truncate text-sm text-foreground/80">
                          {row.category
                            ? (CATEGORY_LABELS[row.category] ?? row.category)
                            : 'Uncategorised'}
                        </span>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                          {formatPaise(row.spentPaise)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ---- By month ---- */}
              <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border bg-muted/60 px-4 py-3">
                  <h2 className="t-subtitle">Month by month</h2>
                </div>
                {report!.months.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing to show.
                  </p>
                ) : (
                  // The columns stretch to the row's height so the bars' percentage
                  // heights have a definite parent to resolve against. With an
                  // auto-height column a percentage height computes to zero and the
                  // chart renders empty.
                  <div className="flex h-48 items-stretch gap-1.5 px-4 py-4">
                    {report!.months.map((month) => (
                      <div
                        key={month.month}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                        title={`${monthLabel(month.month)} — ${formatPaise(month.spentPaise)}`}
                      >
                        {/* min-h keeps a near-zero month visible as a sliver. */}
                        <div
                          className="w-full shrink-0 rounded-t bg-primary/80 transition-[height] duration-500"
                          style={{
                            height: `${Math.max(3, (month.spentPaise / maxMonth) * 100)}%`,
                            minHeight: '4px',
                          }}
                        />
                        <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                          {monthLabel(month.month)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <p className="t-meta px-1">
              These are shares of expenses, not balances. What people owe each other is on
              the group dashboard.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
};
