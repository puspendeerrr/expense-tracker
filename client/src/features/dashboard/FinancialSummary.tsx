import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  PieChart,
  Receipt,
  Scale,
  Wallet,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaiseCompact } from '@/lib/money';
import type { AnalyticsRegion, LiveRegion } from '@/types/domain';

/**
 * Financial summary.
 *
 * The cards are split into two deliberately separate bands, because conflating them is
 * the single easiest way to mislead someone about their money:
 *
 *   POSITION  (live, never date-filtered)  net balance, you owe, you are owed
 *   ACTIVITY  (the selected period)        group spending, paid by me, my share
 *
 * "Total paid by me" is what left my pocket. "My share" is what I consumed. "You need
 * to pay" is what I still owe today. Three different questions, three different cards.
 */

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'negative' | 'positive';
  isRefreshing?: boolean;
  /** When present the card becomes a button that opens its breakdown. */
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  isRefreshing,
  onClick,
}) => {
  // Renders as a real <button> when actionable, so it is keyboard reachable and
  // announced correctly rather than being a div with a click handler.
  const Element = onClick ? 'button' : 'div';

  return (
  <Element
    {...(onClick ? { type: 'button' as const, onClick } : {})}
    className={cn(
      'relative w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors',
      tone === 'negative' && 'border-red-100 bg-red-50/40',
      tone === 'positive' && 'border-emerald-100 bg-emerald-50/40',
      tone === 'neutral' && 'border-slate-200',
      isRefreshing && 'opacity-70',
      onClick &&
        'hover:border-slate-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <span
        className={cn(
          'shrink-0',
          tone === 'negative' && 'text-red-500',
          tone === 'positive' && 'text-emerald-600',
          tone === 'neutral' && 'text-slate-400',
        )}
      >
        {icon}
      </span>
    </div>
    <p
      className={cn(
        // Tabular figures stop the numbers jittering as they refresh.
        'mt-2 font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl',
        tone === 'negative' && 'text-red-700',
        tone === 'positive' && 'text-emerald-700',
        tone === 'neutral' && 'text-slate-900',
      )}
    >
      {value}
    </p>
    {hint && (
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        {hint}
        {onClick && <ChevronRight className="h-3 w-3" />}
      </p>
    )}
  </Element>
  );
};

const StatSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="mt-3 h-7 w-28" />
    <Skeleton className="mt-2 h-3 w-20" />
  </div>
);

interface FinancialSummaryProps {
  live: LiveRegion | null;
  analytics: AnalyticsRegion | null;
  liveLoading: boolean;
  liveRefreshing: boolean;
  analyticsLoading: boolean;
  analyticsRefreshing: boolean;
  rangeLabel: string;
  onShowBreakdown: (kind: 'net' | 'owe' | 'owed') => void;
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({
  live,
  analytics,
  liveLoading,
  liveRefreshing,
  analyticsLoading,
  analyticsRefreshing,
  rangeLabel,
  onShowBreakdown,
}) => {
  const net = live?.balances.netBalance.paise ?? 0;

  return (
    <div className="space-y-5">
      {/* ---- Current position ---- */}
      <section aria-labelledby="position-heading">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 id="position-heading" className="text-sm font-bold text-slate-900">
            Your position
          </h2>
          <span className="text-xs text-slate-500">All time</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {liveLoading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Net balance"
                value={formatPaiseCompact(net)}
                hint={
                  net > 0
                    ? 'You are owed overall'
                    : net < 0
                      ? 'You owe overall'
                      : 'All settled up'
                }
                icon={<Scale className="h-4 w-4" />}
                onClick={() => onShowBreakdown('net')}
                tone={net > 0 ? 'positive' : net < 0 ? 'negative' : 'neutral'}
                isRefreshing={liveRefreshing}
              />
              <StatCard
                label="You need to pay"
                value={formatPaiseCompact(live?.balances.youNeedToPayTotal.paise ?? 0)}
                hint={`${live?.balances.peopleIOweCount ?? 0} ${
                  (live?.balances.peopleIOweCount ?? 0) === 1 ? 'person' : 'people'
                }`}
                icon={<ArrowUpRight className="h-4 w-4" />}
                onClick={() => onShowBreakdown('owe')}
                tone={(live?.balances.youNeedToPayTotal.paise ?? 0) > 0 ? 'negative' : 'neutral'}
                isRefreshing={liveRefreshing}
              />
              <StatCard
                label="You will receive"
                value={formatPaiseCompact(live?.balances.youWillReceiveTotal.paise ?? 0)}
                hint={`${live?.balances.peopleWhoOweMeCount ?? 0} ${
                  (live?.balances.peopleWhoOweMeCount ?? 0) === 1 ? 'person' : 'people'
                }`}
                icon={<ArrowDownLeft className="h-4 w-4" />}
                onClick={() => onShowBreakdown('owed')}
                tone={
                  (live?.balances.youWillReceiveTotal.paise ?? 0) > 0 ? 'positive' : 'neutral'
                }
                isRefreshing={liveRefreshing}
              />
            </>
          )}
        </div>
      </section>

      {/* ---- Period activity ---- */}
      <section aria-labelledby="activity-heading">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 id="activity-heading" className="text-sm font-bold text-slate-900">
            Spending
          </h2>
          <span className="truncate text-xs text-slate-500">{rangeLabel}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {analyticsLoading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Group spending"
                value={formatPaiseCompact(analytics?.periodSummary.totalExpense.paise ?? 0)}
                hint={`${analytics?.periodSummary.expenseCount ?? 0} ${
                  (analytics?.periodSummary.expenseCount ?? 0) === 1 ? 'expense' : 'expenses'
                }`}
                icon={<Receipt className="h-4 w-4" />}
                isRefreshing={analyticsRefreshing}
              />
              <StatCard
                label="Total paid by me"
                value={formatPaiseCompact(analytics?.periodSummary.totalPaidByMe.paise ?? 0)}
                hint="Money I fronted"
                icon={<Wallet className="h-4 w-4" />}
                isRefreshing={analyticsRefreshing}
              />
              <StatCard
                label="My share"
                value={formatPaiseCompact(analytics?.periodSummary.myShare.paise ?? 0)}
                hint="My actual cost"
                icon={<PieChart className="h-4 w-4" />}
                isRefreshing={analyticsRefreshing}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
};
