import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Info, Sparkles, WalletMinimal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { getSettlementPlan } from '@/lib/domainApi';
import { formatPaise } from '@/lib/money';
import type { PersonRef } from '@/types/domain';

/**
 * Suggested settle-up plan.
 *
 * A view over the balance engine, not a second ledger. The detailed who-owes-whom
 * breakdown elsewhere in the app stays directional and un-netted; this panel only
 * answers "what is the shortest way to clear it?".
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It does not claim the plan is minimal. The planner is greedy, which bounds the
 *    result at one fewer payment than there are people with a balance.
 * 2. It does not offer a Settle button on a transfer the settlement engine would
 *    reject. Because debts are directional, "A pays C" can be the right advice while
 *    A has no direct debt to C, and a button there would fail on tap.
 */

type Transfer = {
  from: PersonRef;
  to: PersonRef;
  amountPaise: number;
  recordablePaise: number;
  recordable: boolean;
  involvesMe: boolean;
};

type Plan = {
  currentTransferCount: number;
  suggestedTransferCount: number;
  allSettled: boolean;
  transfers: Transfer[];
};

interface SettleUpPlanProps {
  groupId: string;
  currentUserId: string;
  /** Opens the settle dialog for a transfer that can actually be recorded. */
  onSettle: (counterpart: PersonRef, amountPaise: number) => void;
  /** Bumped by the page when settlements change, so the plan refreshes. */
  refreshKey?: number;
}

const name = (person: PersonRef, currentUserId: string) =>
  person.id === currentUserId ? 'You' : person.fullName;

export const SettleUpPlan: React.FC<SettleUpPlanProps> = ({
  groupId,
  currentUserId,
  onSettle,
  refreshKey = 0,
}) => {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const data = await getSettlementPlan(groupId, signal);
        setPlan(data);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        setError(err instanceof ApiClientError ? err.message : 'Could not build a plan.');
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
        <p className="text-sm text-slate-600">{error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!plan || plan.allSettled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <WalletMinimal className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">Everyone is settled up</p>
          <p className="t-meta text-emerald-700">There is nothing to pay right now.</p>
        </div>
      </div>
    );
  }

  const saved = plan.currentTransferCount - plan.suggestedTransferCount;
  const visible = isExpanded ? plan.transfers : plan.transfers.filter((t) => t.involvesMe);
  // When none of the transfers are the viewer's, showing an empty list would be worse
  // than showing the whole plan.
  const rows = visible.length > 0 ? visible : plan.transfers;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Settle up faster</h3>
          <p className="t-meta">
            {saved > 0
              ? `${plan.suggestedTransferCount} payment${
                  plan.suggestedTransferCount === 1 ? '' : 's'
                } instead of ${plan.currentTransferCount}.`
              : `${plan.suggestedTransferCount} payment${
                  plan.suggestedTransferCount === 1 ? '' : 's'
                } clears the group.`}
          </p>
        </div>
      </div>

      <ul>
        {rows.map((transfer, index) => (
          <li
            key={`${transfer.from.id}-${transfer.to.id}-${index}`}
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3',
              index > 0 && 'border-t border-slate-100',
              transfer.involvesMe && 'bg-primary/[0.03]',
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span className="truncate font-semibold text-slate-900">
                {name(transfer.from, currentUserId)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate font-semibold text-slate-900">
                {name(transfer.to, currentUserId)}
              </span>
            </div>

            <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
              {formatPaise(transfer.amountPaise)}
            </span>

            {transfer.from.id === currentUserId && transfer.recordable && (
              <Button
                size="sm"
                className="ml-auto min-h-[40px] shrink-0"
                onClick={() => onSettle(transfer.to, transfer.amountPaise)}
              >
                Settle
              </Button>
            )}
          </li>
        ))}
      </ul>

      {/*
        Honest about the gap between the advice and what can be recorded. A transfer
        that nets through someone else is still the right thing to do -- it just cannot
        be logged as one payment against a debt that does not exist.
      */}
      {rows.some((transfer) => !transfer.recordable) && (
        <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p className="t-meta">
            Some of these net through another person, so they cannot be recorded as a
            single payment. Pay them as usual and log each one against who you actually
            borrowed from.
          </p>
        </div>
      )}

      {plan.transfers.length > rows.length && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="min-h-[44px] w-full border-t border-slate-100 text-xs font-semibold text-primary hover:bg-slate-50"
        >
          Show all {plan.transfers.length} payments
        </button>
      )}
    </div>
  );
};
