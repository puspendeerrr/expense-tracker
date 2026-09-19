import React, { useMemo, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { initialsOf } from '@/lib/names';
import type { DueEntry, LiveRegion } from '@/types/domain';

/**
 * Who owes whom, as one list.
 *
 * Previously two tab panels, each separately paginated. That put the two halves of a
 * single question behind a click and cost a tab strip plus two sets of pager controls
 * for what is usually five or six rows. One list sorted by size shows the whole picture
 * at once, and colour carries the direction: green is owed to you, red is owed by you.
 *
 * A person who both owes you and is owed by you appears twice, once per direction. That
 * looks redundant until you try to settle: the two debts are separate obligations that
 * are settled separately, and netting them here would invent a figure the ledger does
 * not hold.
 *
 * "Show all" rather than paging, because the count is bounded by group size and an
 * expanding list keeps the reader's position; a pager does not.
 */

const COLLAPSED_ROWS = 6;

interface Row {
  entry: DueEntry;
  direction: 'i_owe' | 'owes_me';
}

const PersonRow: React.FC<{
  row: Row;
  onSettle: (entry: DueEntry) => void;
  onRemind: (entry: DueEntry) => void;
}> = ({ row, onSettle, onRemind }) => {
  const owed = row.direction === 'owes_me';

  return (
    <li className="row-interactive flex items-center gap-3 px-3.5 py-2.5">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs',
            owed
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-700 dark:text-red-400',
          )}
        >
          {initialsOf(row.entry.user.fullName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {row.entry.user.fullName}
        </p>
        <p className="t-meta">{owed ? 'owes you' : 'you owe'}</p>
      </div>

      <span
        className={cn(
          't-money shrink-0 text-sm',
          owed
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400',
        )}
      >
        {formatPaise(row.entry.amountPaise)}
      </span>

      {owed ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRemind(row.entry)}
          className="h-9 shrink-0 px-3"
        >
          Remind
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => onSettle(row.entry)}
          className="h-9 shrink-0 px-3"
        >
          Settle
        </Button>
      )}
    </li>
  );
};

interface BalanceListProps {
  live: LiveRegion | null;
  isLoading: boolean;
  onSettle: (entry: DueEntry) => void;
  onRemind: (entry: DueEntry) => void;
}

export const BalanceList: React.FC<BalanceListProps> = ({
  live,
  isLoading,
  onSettle,
  onRemind,
}) => {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const all: Row[] = [
      ...(live?.peopleWhoOweMe ?? []).map((entry) => ({
        entry,
        direction: 'owes_me' as const,
      })),
      ...(live?.peopleIOwe ?? []).map((entry) => ({ entry, direction: 'i_owe' as const })),
    ];
    return all.sort((a, b) => b.entry.amountPaise - a.entry.amountPaise);
  }, [live]);

  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <section aria-labelledby="balances-heading" className="space-y-2">
      <h2 id="balances-heading" className="t-subtitle">
        Balances
      </h2>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-3.5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-9 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <PartyPopper className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-muted-foreground">
              Everyone is square. Nothing to settle.
            </p>
          </div>
        ) : (
          <>
            <ul className="stagger-children divide-y divide-border">
              {visible.map((row) => (
                <PersonRow
                  key={`${row.entry.user.id}-${row.direction}`}
                  row={row}
                  onSettle={onSettle}
                  onRemind={onRemind}
                />
              ))}
            </ul>

            {(hidden > 0 || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((open) => !open)}
                className="w-full border-t border-border py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {expanded ? 'Show less' : `Show ${hidden} more`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
};
