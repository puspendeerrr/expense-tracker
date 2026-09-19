import React, { useState } from 'react';
import { ChevronDown, Users2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { formatDisplayDate } from '@/lib/dateRange';
import type { RelationshipRow } from '@/types/domain';

/**
 * Person-wise financial relationships.
 *
 * The critical distinction this section exists to preserve:
 *
 *   "I paid for them"      historical attribution over the selected period
 *   "I currently owe"      a live obligation, all-time, from the balance engine
 *
 * Paying ₹2,000 for someone does NOT mean they still owe ₹2,000 - they may have
 * settled. The two are shown in separate, labelled column groups and are never summed
 * together into a single "net" figure.
 *
 * Desktop gets a table. Mobile gets expandable cards: the headline (who, and what is
 * live between us) is always visible, and the historical detail expands on demand
 * rather than dumping six numbers onto a 320px screen.
 */

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const MoneyCell: React.FC<{ paise: number; tone?: 'owe' | 'owed' | 'muted' }> = ({
  paise,
  tone = 'muted',
}) => (
  <span
    className={cn(
      'font-mono text-sm font-semibold tabular-nums',
      paise === 0 && 'text-muted-foreground',
      paise > 0 && tone === 'owe' && 'text-red-600 dark:text-red-400',
      paise > 0 && tone === 'owed' && 'text-emerald-600 dark:text-emerald-400',
      paise > 0 && tone === 'muted' && 'text-foreground/80',
    )}
  >
    {formatPaise(paise)}
  </span>
);

const MobileCard: React.FC<{ row: RelationshipRow }> = ({ row }) => {
  const [expanded, setExpanded] = useState(false);
  const iOwe = row.iCurrentlyOwe?.paise ?? 0;
  const theyOwe = row.theyCurrentlyOwe?.paise ?? 0;

  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback>{initials(row.person.fullName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {row.person.fullName}
            {!row.isStillMember && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(left)</span>
            )}
          </p>
          {/* Both directions are shown when both are live: this product never nets
              them, so hiding one would misrepresent the relationship. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {iOwe === 0 && theyOwe === 0 ? (
              <span>Settled up</span>
            ) : (
              <>
                {iOwe > 0 && (
                  <span>
                    You owe <MoneyCell paise={iOwe} tone="owe" />
                  </span>
                )}
                {theyOwe > 0 && (
                  <span>
                    Owes you <MoneyCell paise={theyOwe} tone="owed" />
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <dl className="space-y-2 bg-muted/70 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            This period
          </p>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">I paid for them</dt>
            <dd>
              <MoneyCell paise={row.iPaidForThem.paise} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">They paid for me</dt>
            <dd>
              <MoneyCell paise={row.theyPaidForMe.paise} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Shared expenses</dt>
            <dd className="text-sm font-medium text-foreground/80">{row.relatedExpenseCount}</dd>
          </div>
          {row.lastRelatedExpenseDate && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Last activity</dt>
              <dd className="text-sm font-medium text-foreground/80">
                {formatDisplayDate(row.lastRelatedExpenseDate)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
};

interface RelationshipSectionProps {
  relationships: RelationshipRow[];
  isLoading: boolean;
  isRefreshing: boolean;
}

export const RelationshipSection: React.FC<RelationshipSectionProps> = ({
  relationships,
  isLoading,
  isRefreshing,
}) => (
  <section aria-labelledby="relationships-heading" className="space-y-3">
    <h2
      id="relationships-heading"
      className="flex items-center gap-2 text-sm font-bold text-foreground"
    >
      <Users2 className="h-4 w-4 text-muted-foreground" />
      Financial relationships
    </h2>

    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-opacity',
        isRefreshing && 'opacity-70',
      )}
    >
      {isLoading ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : relationships.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No shared expenses with anyone yet.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: expandable cards */}
          <ul className="lg:hidden">
            {relationships.map((row) => (
              <MobileCard key={row.person.id} row={row} />
            ))}
          </ul>

          {/* Desktop: full table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/80">
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Person
                  </th>
                  <th
                    scope="col"
                    colSpan={2}
                    className="border-l border-border px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    This period
                  </th>
                  <th
                    scope="col"
                    colSpan={2}
                    className="border-l border-border px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Outstanding now
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Shared
                  </th>
                </tr>
                <tr className="border-b border-border text-xs">
                  <th scope="col" className="px-4 pb-2 text-left font-medium text-muted-foreground">
                    &nbsp;
                  </th>
                  <th
                    scope="col"
                    className="border-l border-border px-4 pb-2 text-right font-medium text-muted-foreground"
                  >
                    I paid for them
                  </th>
                  <th scope="col" className="px-4 pb-2 text-right font-medium text-muted-foreground">
                    They paid for me
                  </th>
                  <th
                    scope="col"
                    className="border-l border-border px-4 pb-2 text-right font-medium text-muted-foreground"
                  >
                    I owe
                  </th>
                  <th scope="col" className="px-4 pb-2 text-right font-medium text-muted-foreground">
                    They owe
                  </th>
                  <th scope="col" className="px-4 pb-2 text-right font-medium text-muted-foreground">
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((row) => (
                  <tr
                    key={row.person.id}
                    className="border-b border-border last:border-b-0 hover:bg-accent/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{initials(row.person.fullName)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">
                          {row.person.fullName}
                          {!row.isStillMember && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (left)
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="border-l border-border px-4 py-3 text-right">
                      <MoneyCell paise={row.iPaidForThem.paise} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MoneyCell paise={row.theyPaidForMe.paise} />
                    </td>
                    <td className="border-l border-border px-4 py-3 text-right">
                      <MoneyCell paise={row.iCurrentlyOwe?.paise ?? 0} tone="owe" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MoneyCell paise={row.theyCurrentlyOwe?.paise ?? 0} tone="owed" />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {row.relatedExpenseCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>

    <p className="px-1 text-xs leading-relaxed text-muted-foreground">
      Amounts on the left are what was spent in the selected period. Amounts on the right
      are what is still owed today — paying for someone does not mean they still owe you.
    </p>
  </section>
);
