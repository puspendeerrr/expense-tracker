import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { useValueChange } from '@/hooks/useValueChange';
import type { LiveRegion } from '@/types/domain';

/**
 * The headline balance.
 *
 * One sentence answering the only question most people open this app for: am I up or
 * down, and by how much. It replaces a row of three equally-weighted cards, which made
 * the reader compare three numbers to work out the one they wanted.
 *
 * The two directions stay visible underneath rather than being folded into the net
 * figure, because the product never nets them: owing Ana 500 while Bob owes you 500 is
 * not the same situation as everyone being square, and only the split figures say so.
 *
 * Nothing here is affected by the dashboard's date filter. These are obligations, not
 * activity, and a balance that moved when someone changed a date range would be wrong.
 */

interface BalanceHeroProps {
  live: LiveRegion | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onShowBreakdown: (kind: 'net' | 'owe' | 'owed') => void;
}

const Split: React.FC<{
  label: string;
  value: string;
  /** The raw figure, watched so the card can react when it moves. */
  paise: number;
  count: number;
  tone: 'owe' | 'owed';
  onClick: () => void;
}> = ({ label, value, count, tone, onClick, paise }) => {
  const Icon = tone === 'owe' ? ArrowUpRight : ArrowDownLeft;
  const changed = useValueChange(paise);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'press flex flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tone === 'owe'
          ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
          : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          tone === 'owe'
            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            't-money block text-base leading-tight',
            changed,
            tone === 'owe'
              ? 'text-red-700 dark:text-red-400'
              : 'text-emerald-700 dark:text-emerald-400',
          )}
        >
          {value}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {count} {count === 1 ? 'person' : 'people'}
        </span>
      </span>
    </button>
  );
};

export const BalanceHero: React.FC<BalanceHeroProps> = ({
  live,
  isLoading,
  isRefreshing,
  onShowBreakdown,
}) => {
  const net = live?.balances.netBalance.paise ?? 0;
  const owe = live?.balances.youNeedToPayTotal.paise ?? 0;
  const owed = live?.balances.youWillReceiveTotal.paise ?? 0;

  // Above the loading branch on purpose: a hook after an early return runs a different
  // number of times once `isLoading` flips, which React rejects outright. Passing null
  // while there is no data also stops the first real figure counting as a change.
  const netChanged = useValueChange(live ? net : null);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-9 w-48" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-[62px] flex-1 rounded-xl" />
          <Skeleton className="h-[62px] flex-1 rounded-xl" />
        </div>
      </section>
    );
  }

  const headline =
    net > 0 ? 'You are owed overall' : net < 0 ? 'You owe overall' : 'You are all settled up';

  return (
    <section
      aria-label="Your balance"
      className={cn(
        'rounded-2xl border border-border bg-card p-4 shadow-sm transition-opacity',
        isRefreshing && 'opacity-70',
      )}
    >
      <p className="t-eyebrow">{headline}</p>

      <button
        type="button"
        onClick={() => onShowBreakdown('net')}
        className="mt-0.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            't-money text-3xl sm:text-4xl',
            netChanged,
            net > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : net < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-foreground',
          )}
        >
          {/* Sign is carried by the wording and the colour, so the figure itself is
              shown as a magnitude -- "-₹500 you owe" reads as a double negative. */}
          {formatPaise(Math.abs(net))}
        </span>
      </button>

      {owe === 0 && owed === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing outstanding with anyone in this group.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Split
            label="You owe"
            value={formatPaise(owe)}
            paise={owe}
            count={live?.balances.peopleIOweCount ?? 0}
            tone="owe"
            onClick={() => onShowBreakdown('owe')}
          />
          <Split
            label="You are owed"
            value={formatPaise(owed)}
            paise={owed}
            count={live?.balances.peopleWhoOweMeCount ?? 0}
            tone="owed"
            onClick={() => onShowBreakdown('owed')}
          />
        </div>
      )}
    </section>
  );
};
