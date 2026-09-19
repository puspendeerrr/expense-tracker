import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import type { AnalyticsRegion, LiveRegion } from '@/types/domain';

/**
 * Insights.
 *
 * Every card here is a restatement of a figure the server already computed -- nothing is
 * inferred, estimated or predicted. That constraint is the whole design: an insight card
 * that guesses is worse than no card, because people act on money figures and have no
 * way to tell a derived number from a made-up one.
 *
 * Cards that have no data simply do not render. An insights strip that pads itself with
 * "no data yet" placeholders trains people to stop reading it.
 */

interface InsightCardsProps {
  live: LiveRegion | null;
  analytics: AnalyticsRegion | null;
  isLoading: boolean;
}

type Insight = {
  id: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'neutral' | 'up' | 'down' | 'warn';
  to?: string;
};

export const InsightCards: React.FC<InsightCardsProps> = ({
  live,
  analytics,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[76px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const insights: Insight[] = [];

  /* ---- Spending against the previous period ---- */
  const previous = analytics?.previousPeriod;
  const current = analytics?.periodSummary.totalExpense.paise ?? 0;

  if (previous && previous.totalExpense.paise > 0) {
    const delta = current - previous.totalExpense.paise;
    // A change under 1% is noise from the calendar, not a trend worth reporting.
    const ratio = delta / previous.totalExpense.paise;

    if (Math.abs(ratio) >= 0.01) {
      insights.push({
        id: 'trend',
        label: delta > 0 ? 'Spending up' : 'Spending down',
        value: `${Math.abs(Math.round(ratio * 100))}%`,
        hint: `${formatPaise(Math.abs(delta))} vs the previous period`,
        icon: delta > 0 ? TrendingUp : TrendingDown,
        tone: delta > 0 ? 'up' : 'down',
      });
    }
  }

  /* ---- Fronted more than consumed ---- */
  const paid = analytics?.periodSummary.totalPaidByMe.paise ?? 0;
  const share = analytics?.periodSummary.myShare.paise ?? 0;
  if (paid - share > 0) {
    insights.push({
      id: 'fronted',
      label: 'You fronted',
      value: formatPaise(paid - share),
      hint: 'More than your own share this period',
      icon: Wallet,
      tone: 'neutral',
      to: '/app/members',
    });
  }

  /* ---- Settlements waiting on this person ---- */
  const awaiting = live?.attention.awaitingMyApprovalCount ?? 0;
  if (awaiting > 0) {
    insights.push({
      id: 'awaiting',
      label: 'Awaiting you',
      value: String(awaiting),
      hint: `${awaiting === 1 ? 'A payment needs' : 'Payments need'} your confirmation`,
      icon: Wallet,
      tone: 'warn',
      to: '/app/settlements?status=paid_pending_approval',
    });
  }

  /* ---- Largest single expense ---- */
  const largest = analytics?.periodSummary.largestExpense;
  if (largest) {
    insights.push({
      id: 'largest',
      label: 'Largest expense',
      value: formatPaise(largest.amountPaise),
      hint: largest.title,
      icon: Receipt,
      tone: 'neutral',
      to: `/app/expenses?expense=${largest.id}`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <section aria-label="Insights">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {insights.slice(0, 3).map((insight) => {
          const inner = (
            <div
              className={cn(
                'h-full rounded-2xl border bg-card p-3 transition-colors',
                insight.tone === 'warn' ? 'border-amber-500/30' : 'border-border',
                insight.to && 'hover:border-primary/40',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {insight.label}
                </p>
                <insight.icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    insight.tone === 'up' && 'text-amber-500',
                    insight.tone === 'down' && 'text-emerald-500',
                    insight.tone === 'warn' && 'text-amber-500',
                    insight.tone === 'neutral' && 'text-muted-foreground',
                  )}
                />
              </div>
              <p className="t-money mt-0.5 truncate text-lg">{insight.value}</p>
              <p className="flex items-center gap-1 truncate t-meta">
                <span className="min-w-0 truncate">{insight.hint}</span>
                {insight.to && <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />}
              </p>
            </div>
          );

          return insight.to ? (
            <Link
              key={insight.id}
              to={insight.to}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {inner}
            </Link>
          ) : (
            <div key={insight.id}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
};
