import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaiseCompact } from '@/lib/money';
import type { AnalyticsRegion } from '@/types/domain';

/**
 * What happened during the selected period.
 *
 * Three figures that only make sense read together, so they share one card instead of
 * occupying three. They answer three different questions and are easy to confuse:
 *
 *   Group spending  everything the group logged
 *   You paid        what left your pocket
 *   Your share      what you actually consumed
 *
 * Deliberately separate from the balance above: this band moves with the date filter,
 * the balance never does. Keeping them in one block was the quickest way to leave
 * someone thinking a filter had changed what they owe.
 */

interface PeriodStripProps {
  analytics: AnalyticsRegion | null;
  isLoading: boolean;
  isRefreshing: boolean;
  rangeLabel: string;
}

const Figure: React.FC<{ label: string; value: string; hint: string }> = ({
  label,
  value,
  hint,
}) => (
  <div className="min-w-0 flex-1 px-3.5 py-3">
    <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="t-money mt-0.5 truncate text-lg text-foreground">{value}</p>
    <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
  </div>
);

export const PeriodStrip: React.FC<PeriodStripProps> = ({
  analytics,
  isLoading,
  isRefreshing,
  rangeLabel,
}) => (
  <section aria-labelledby="period-heading" className="space-y-2">
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="period-heading" className="t-subtitle">
        Spending
      </h2>
      <span className="truncate text-xs text-muted-foreground">{rangeLabel}</span>
    </div>

    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-opacity',
        isRefreshing && 'opacity-70',
      )}
    >
      {isLoading ? (
        <div className="flex">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0 flex-1 px-3.5 py-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-5 w-20" />
              <Skeleton className="mt-1.5 h-3 w-14" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex divide-x divide-border">
          <Figure
            label="Group"
            value={formatPaiseCompact(analytics?.periodSummary.totalExpense.paise ?? 0)}
            hint={`${analytics?.periodSummary.expenseCount ?? 0} ${
              (analytics?.periodSummary.expenseCount ?? 0) === 1 ? 'expense' : 'expenses'
            }`}
          />
          <Figure
            label="You paid"
            value={formatPaiseCompact(analytics?.periodSummary.totalPaidByMe.paise ?? 0)}
            hint="fronted"
          />
          <Figure
            label="Your share"
            value={formatPaiseCompact(analytics?.periodSummary.myShare.paise ?? 0)}
            hint="your cost"
          />
        </div>
      )}
    </div>
  </section>
);
