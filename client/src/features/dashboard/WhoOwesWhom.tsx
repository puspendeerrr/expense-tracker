import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, HandCoins, PartyPopper } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import type { DueEntry, LiveRegion } from '@/types/domain';

/**
 * Who owes whom.
 *
 * Paginated in fixed pages rather than rendering every member: a large group must not
 * produce an unbounded list. Paging is local state, so moving between pages updates only
 * this section and never triggers a dashboard-wide refetch.
 *
 * The two directions live in separate tabs because the product never nets them: if A
 * owes B and B owes A, both are real and both are independently settleable.
 */

const PAGE_SIZE = 5;

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

interface PersonRowProps {
  entry: DueEntry;
  direction: 'i_owe' | 'owes_me';
  onSettle: (entry: DueEntry) => void;
  onRemind: (entry: DueEntry) => void;
}

const PersonRow: React.FC<PersonRowProps> = ({ entry, direction, onSettle, onRemind }) => (
  <li className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
    <Avatar className="h-10 w-10 shrink-0">
      <AvatarFallback
        className={cn(
          direction === 'i_owe' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
        )}
      >
        {initials(entry.user.fullName)}
      </AvatarFallback>
    </Avatar>

    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-900">{entry.user.fullName}</p>
      <p
        className={cn(
          'font-mono text-base font-bold tabular-nums',
          direction === 'i_owe' ? 'text-red-600' : 'text-emerald-600',
        )}
      >
        {formatPaise(entry.amountPaise)}
      </p>
    </div>

    {/* Full-height buttons on mobile: a 36px "sm" button is under the touch target. */}
    {direction === 'i_owe' ? (
      <Button onClick={() => onSettle(entry)} className="h-11 shrink-0 px-4 sm:h-9 sm:px-3">
        Settle
      </Button>
    ) : (
      <Button
        variant="outline"
        onClick={() => onRemind(entry)}
        className="h-11 shrink-0 px-4 sm:h-9 sm:px-3"
      >
        Remind
      </Button>
    )}
  </li>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
    <PartyPopper className="h-8 w-8 text-slate-300" />
    <p className="text-sm font-medium text-slate-500">{message}</p>
  </div>
);

interface PaginatedListProps {
  entries: DueEntry[];
  direction: 'i_owe' | 'owes_me';
  emptyMessage: string;
  onSettle: (entry: DueEntry) => void;
  onRemind: (entry: DueEntry) => void;
}

const PaginatedList: React.FC<PaginatedListProps> = ({
  entries,
  direction,
  emptyMessage,
  onSettle,
  onRemind,
}) => {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));

  // Clamp rather than reset, so a list shrinking under you does not jump to page 1.
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [entries, safePage],
  );

  if (entries.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div>
      <ul>
        {visible.map((entry) => (
          <PersonRow
            key={entry.user.id}
            entry={entry}
            direction={direction}
            onSettle={onSettle}
            onRemind={onRemind}
          />
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
          <span className="text-xs font-medium text-slate-500">
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, entries.length)} of{' '}
            {entries.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

interface WhoOwesWhomProps {
  live: LiveRegion | null;
  isLoading: boolean;
  onSettle: (entry: DueEntry) => void;
  onRemind: (entry: DueEntry) => void;
}

export const WhoOwesWhom: React.FC<WhoOwesWhomProps> = ({
  live,
  isLoading,
  onSettle,
  onRemind,
}) => {
  const iOwe = live?.peopleIOwe ?? [];
  const owesMe = live?.peopleWhoOweMe ?? [];

  return (
    <section aria-labelledby="who-owes-heading" className="space-y-3">
      <h2
        id="who-owes-heading"
        className="flex items-center gap-2 text-sm font-bold text-slate-900"
      >
        <HandCoins className="h-4 w-4 text-slate-400" />
        Who owes whom
      </h2>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-9 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <Tabs defaultValue="i_owe">
            <div className="p-3 pb-0">
              {/* Full width on mobile; capped on desktop so the two tabs do not stretch
                  across the whole card. */}
              <TabsList className="sm:max-w-xs">
                <TabsTrigger value="i_owe">
                  I owe
                  {iOwe.length > 0 && (
                    <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                      {iOwe.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="owes_me">
                  Owes me
                  {owesMe.length > 0 && (
                    <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      {owesMe.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="i_owe" className="mt-3">
              <PaginatedList
                entries={iOwe}
                direction="i_owe"
                emptyMessage="You do not owe anyone right now."
                onSettle={onSettle}
                onRemind={onRemind}
              />
            </TabsContent>

            <TabsContent value="owes_me" className="mt-3">
              <PaginatedList
                entries={owesMe}
                direction="owes_me"
                emptyMessage="Nobody owes you right now."
                onSettle={onSettle}
                onRemind={onRemind}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </section>
  );
};
