import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { formatDisplayDate } from '@/lib/dateRange';
import type { AnalyticsRegion } from '@/types/domain';

/**
 * This period against the one before it.
 *
 * The comparison window is the same length as the current one and sits immediately
 * before it, computed server-side by the same aggregate that produced the current
 * figures. Both halves being identical calculations is what makes the difference
 * meaningful rather than an artefact of two slightly different queries.
 *
 * When the filter is open-ended there is no previous period, and the card says so
 * instead of comparing against zero -- which would render every figure as an infinite
 * increase.
 */

interface PeriodComparisonProps {
  analytics: AnalyticsRegion | null;
  isLoading: boolean;
}

const Row: React.FC<{ label: string; now: number; before: number }> = ({
  label,
  now,
  before,
}) => {
  const delta = now - before;
  const ratio = before === 0 ? null : delta / before;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="t-meta">was {formatPaise(before)}</p>
      </div>

      <p className="t-money shrink-0 text-sm">{formatPaise(now)}</p>

      <span
        className={cn(
          'flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-semibold tabular-nums',
          delta > 0
            ? 'text-amber-600 dark:text-amber-400'
            : delta < 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground',
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {/* A percentage against zero is undefined, not infinite, so it is left out. */}
        {ratio === null ? 'new' : `${Math.abs(Math.round(ratio * 100))}%`}
      </span>
    </div>
  );
};

export const PeriodComparison: React.FC<PeriodComparisonProps> = ({
  analytics,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <section className="space-y-2">
        <h2 className="t-subtitle">Compared with before</h2>
        <Skeleton className="h-32 rounded-2xl" />
      </section>
    );
  }

  const previous = analytics?.previousPeriod;

  return (
    <section aria-labelledby="comparison-heading" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="comparison-heading" className="t-subtitle">
          Compared with before
        </h2>
        {previous && (
          <span className="truncate text-xs text-muted-foreground">
            {formatDisplayDate(previous.from)} – {formatDisplayDate(previous.to)}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {!previous ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Pick a date range to compare it with the period before it.
          </p>
        ) : (
          <div className="divide-y divide-border">
            <Row
              label="Group spending"
              now={analytics?.periodSummary.totalExpense.paise ?? 0}
              before={previous.totalExpense.paise}
            />
            <Row
              label="You paid"
              now={analytics?.periodSummary.totalPaidByMe.paise ?? 0}
              before={previous.totalPaidByMe.paise}
            />
            <Row
              label="Your share"
              now={analytics?.periodSummary.myShare.paise ?? 0}
              before={previous.myShare.paise}
            />
          </div>
        )}
      </div>
    </section>
  );
};
