import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SettlementDetail } from './SettlementDetail';
import { toast } from 'sonner';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupContext';
import { useRealtime } from '@/hooks/useRealtime';
import {
  approveSettlement,
  cancelSettlement,
  getGroup,
  listSettlements,
  getOutstanding,
  rejectSettlement,
} from '@/lib/domainApi';
import { formatPaise } from '@/lib/money';
import { ImageViewer } from '@/components/ImageViewer';
import { SettleUpPlan } from './SettleUpPlan';
import { SettleDialog } from './SettleDialog';
import type {
  GroupMemberSummary,
  Pagination,
  PersonRef,
  Settlement,
  SettlementStatus,
} from '@/types/domain';

/**
 * Settlement history.
 *
 * Every settlement is listed with the one fact that matters most: whether it has
 * actually moved a balance. Only `completed` does; a pending or rejected settlement is
 * shown but explicitly marked as not counted, so the history can never be misread as
 * money that has changed hands.
 */

const PAGE_SIZE = 15;

const STATUS_FILTERS: { value: SettlementStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid_pending_approval', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'will_pay_soon', label: 'Promised' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_META: Record<
  SettlementStatus,
  { label: string; className: string; affectsBalance: boolean }
> = {
  completed: {
    label: 'Confirmed',
    className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
    affectsBalance: true,
  },
  paid_pending_approval: {
    label: 'Awaiting confirmation',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    affectsBalance: false,
  },
  will_pay_soon: {
    label: 'Promised',
    className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
    affectsBalance: false,
  },
  rejected: {
    label: 'Not confirmed',
    className: 'bg-red-500/15 text-red-800 dark:text-red-300',
    affectsBalance: false,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-muted text-muted-foreground',
    affectsBalance: false,
  },
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const SettlementsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeGroupId, activeGroup } = useGroups();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /*
   * Seeded from the URL so a deep link can open this screen already narrowed --
   * "3 payments awaiting you" on the dashboard lands here showing exactly those.
   * Validated against the known statuses rather than trusted, since it is user input.
   */
  const initialStatus = (() => {
    const raw = searchParams.get('status');
    const known: (SettlementStatus | 'all')[] = [
      'all',
      'will_pay_soon',
      'paid_pending_approval',
      'completed',
      'rejected',
      'cancelled',
    ];
    return known.includes(raw as SettlementStatus) ? (raw as SettlementStatus) : 'all';
  })();

  const [status, setStatus] = useState<SettlementStatus | 'all'>(initialStatus);
  const [page, setPage] = useState(0);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState<Settlement | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofViewing, setProofViewing] = useState<Settlement | null>(null);
  const [settling, setSettling] = useState<PersonRef | null>(null);
  /** Bumped whenever a settlement changes, so the plan recomputes. */
  const [planKey, setPlanKey] = useState(0);

  /**
   * The settlement open in the detail sheet, addressed by URL.
   *
   * Held in the query string rather than in state so a notification can deep-link
   * straight to one, and so closing the sheet is a back-navigation rather than a
   * separate gesture the browser knows nothing about.
   */
  const detailId = searchParams.get('settlement');

  const openDetail = useCallback(
    (id: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) next.set('settlement', id);
          else next.delete('settlement');
          return next;
        },
        { replace: !id },
      );
    },
    [setSearchParams],
  );

  /**
   * The live debt between the two people in the open settlement.
   *
   * Fetched from the balance engine rather than derived from the settlement amount:
   * what someone still owes depends on every other expense and payment between them,
   * which this screen has no business recomputing.
   */
  const [outstandingPaise, setOutstandingPaise] = useState<number | null>(null);

  const detailSettlement = useMemo(
    () => settlements?.find((row) => row.id === detailId) ?? null,
    [settlements, detailId],
  );

  /**
   * Headline figures for the settlements on screen.
   *
   * Summed from the rows the server returned for the current filter, and labelled as
   * such -- these are not a second opinion on anyone's balance, which only the balance
   * engine gives. Cancelled and rejected settlements are excluded from every total
   * because they moved no money.
   */
  const insights = useMemo(() => {
    const rows = settlements ?? [];
    const settled = rows.filter((row) => row.status === 'completed');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return {
      paid: settled
        .filter((row) => row.payerId === user?.id)
        .reduce((total, row) => total + row.amountPaise, 0),
      received: settled
        .filter((row) => row.receiverId === user?.id)
        .reduce((total, row) => total + row.amountPaise, 0),
      pending: rows
        .filter((row) => row.status === 'paid_pending_approval')
        .reduce((total, row) => total + row.amountPaise, 0),
      completedThisMonth: settled.filter(
        (row) => new Date(row.verifiedAt ?? row.createdAt) >= startOfMonth,
      ).length,
      count: rows.length,
    };
  }, [settlements, user?.id]);

  useEffect(() => {
    if (!activeGroupId || !detailSettlement || !user) {
      setOutstandingPaise(null);
      return;
    }

    const counterpartId =
      detailSettlement.payerId === user.id
        ? detailSettlement.receiverId
        : detailSettlement.payerId;

    // Someone else's settlement: this account is not party to that debt and has no
    // business being shown a figure for it.
    if (
      detailSettlement.payerId !== user.id &&
      detailSettlement.receiverId !== user.id
    ) {
      setOutstandingPaise(null);
      return;
    }

    let cancelled = false;
    setOutstandingPaise(null);

    void getOutstanding(activeGroupId, counterpartId)
      .then((data) => {
        if (cancelled) return;
        // Whichever direction this settlement runs, show the debt it was paying down.
        setOutstandingPaise(
          detailSettlement.payerId === user.id ? data.iOwePaise : data.theyOwePaise,
        );
      })
      .catch(() => {
        if (!cancelled) setOutstandingPaise(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroupId, detailSettlement, user]);

  const nameOf = useCallback(
    (userId: string): string => {
      if (userId === user?.id) return 'You';
      return members.find((member) => member.id === userId)?.fullName ?? 'Member';
    },
    [members, user?.id],
  );

  const load = useCallback(async () => {
    if (!activeGroupId) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await listSettlements(activeGroupId, {
        status,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setSettlements(data.settlements);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not load settlement history.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeGroupId, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeGroupId) return;
    let cancelled = false;
    void getGroup(activeGroupId)
      .then((data) => {
        if (!cancelled) setMembers(data.members);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeGroupId]);

  useRealtime(
    activeGroupId,
    useCallback(
      (payload) => {
        if (payload.event.startsWith('settlement:')) void load();
      },
      [load],
    ),
  );

  const act = async (
    settlement: Settlement,
    action: 'approve' | 'reject' | 'cancel',
    reason = '',
  ) => {
    if (!activeGroupId || busyId) return;
    setBusyId(settlement.id);
    try {
      if (action === 'approve') {
        await approveSettlement(activeGroupId, settlement.id);
        toast.success(`Confirmed ${formatPaise(settlement.amountPaise)}`, {
          description: 'Balances have been updated.',
        });
      } else if (action === 'reject') {
        await rejectSettlement(activeGroupId, settlement.id, reason);
        toast.success('Marked as not received', {
          description: 'The balance is unchanged.',
        });
        setRejecting(null);
        setRejectReason('');
      } else {
        await cancelSettlement(activeGroupId, settlement.id);
        toast.success('Settlement cancelled');
      }
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'That action failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell title="Settlement History">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:px-6">
        {/* ---- Suggested plan (advice only; never writes) ---- */}
        {activeGroupId && user && (
          <SettleUpPlan
            groupId={activeGroupId}
            currentUserId={user.id}
            refreshKey={planKey}
            onSettle={(counterpart) => setSettling(counterpart)}
          />
        )}

        {/* ---- Insights ----
          *
          * Totals for the settlements currently listed, not a restatement of anyone's
          * balance. Labelled "in this view" so the figures cannot be mistaken for the
          * authoritative outstanding amounts, which only the balance engine produces.
          */}
        {!isLoading && (settlements?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: 'You paid', value: formatPaise(insights.paid) },
              { label: 'You received', value: formatPaise(insights.received) },
              { label: 'Awaiting confirmation', value: formatPaise(insights.pending) },
              {
                label: 'Completed this month',
                value: String(insights.completedThisMonth),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.08] bg-[#18181B] p-3 shadow-md"
              >
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.label}
                </p>
                <p className="t-money mt-1 truncate text-base font-bold text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ---- Status filter ---- */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setStatus(option.value);
                setPage(0);
              }}
              aria-pressed={status === option.value}
              className={cn(
                'min-h-[40px] shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                status === option.value
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 font-bold shadow-sm shadow-emerald-950/30'
                  : 'border-white/[0.08] bg-[#111827] text-slate-400 hover:bg-[#18181B] hover:text-slate-200',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            'overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-opacity',
            isRefreshing && !isLoading && 'opacity-70',
          )}
        >
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={load}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <ul>
              {[0, 1, 2, 3].map((index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </li>
              ))}
            </ul>
          ) : (settlements?.length ?? 0) === 0 ? (
            <div className="px-4 py-14 text-center">
              <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-lg shadow-emerald-950/30">
                <History className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="mt-2 text-base font-semibold text-slate-100">
                No settlements {status !== 'all' && 'with this status'}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">
                Settlements appear here once someone records a payment or settles a balance.
              </p>
            </div>
          ) : (
            <ul>
              {settlements?.map((settlement) => {
                const meta = STATUS_META[settlement.status];
                const isReceiver = settlement.receiverId === user?.id;
                const isPayer = settlement.payerId === user?.id;
                const canApprove =
                  isReceiver && settlement.status === 'paid_pending_approval';
                const canCancel =
                  (isPayer || isReceiver) &&
                  ['paid_pending_approval', 'will_pay_soon', 'rejected'].includes(
                    settlement.status,
                  );
                const isBusy = busyId === settlement.id;

                return (
                  <li key={settlement.id} className="border-t border-border first:border-t-0">
                    {/* The whole row opens the detail. Rendered as a button so it is
                        reachable by keyboard and announced as actionable, rather than a
                        div with a click handler that neither is. */}
                    <button
                      type="button"
                      onClick={() => openDetail(settlement.id)}
                      aria-label={`Settlement of ${formatPaise(settlement.amountPaise)} from ${nameOf(settlement.payerId)} to ${nameOf(settlement.receiverId)}`}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          {initials(nameOf(settlement.payerId))}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {nameOf(settlement.payerId)} → {nameOf(settlement.receiverId)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-bold',
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                          <span className="t-meta">
                            {settlement.paymentMethod === 'upi' ? 'UPI' : 'Cash'} ·{' '}
                            {new Date(settlement.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        {settlement.hasProof && (
                          // A plain marker rather than a nested button: a button inside a
                          // button is invalid, and the proof is one tap away in the detail.
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                            <ImageIcon className="h-3.5 w-3.5" />
                            Proof attached
                          </span>
                        )}
                        {settlement.rejectionReason && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {settlement.rejectionReason}
                          </p>
                        )}
                        {/* The single most important fact about a settlement row. */}
                        {!meta.affectsBalance && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Does not affect balances
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            't-money text-sm',
                            meta.affectsBalance ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {formatPaise(settlement.amountPaise)}
                        </p>
                      </div>
                    </button>

                    {(canApprove || canCancel) && (
                      <div className="flex flex-wrap gap-2 border-t border-border bg-muted/60 px-4 py-2.5">
                        {canApprove && (
                          <>
                            <Button
                              size="sm"
                              className="h-9"
                              disabled={isBusy}
                              onClick={() => void act(settlement, 'approve')}
                            >
                              {isBusy ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Confirm receipt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9"
                              disabled={isBusy}
                              onClick={() => setRejecting(settlement)}
                            >
                              <X className="mr-1.5 h-3.5 w-3.5" />
                              Not received
                            </Button>
                          </>
                        )}
                        {canCancel && !canApprove && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9"
                            disabled={isBusy}
                            onClick={() => void act(settlement, 'cancel')}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {pagination && pagination.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="t-meta">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, pagination.total)} of{' '}
                {pagination.total}
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pagination.hasMore}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImageViewer
        open={Boolean(proofViewing)}
        onOpenChange={(open) => !open && setProofViewing(null)}
        src={proofViewing?.proofUrl ?? null}
        title="Payment proof"
        caption={
          proofViewing
            ? `${nameOf(proofViewing.payerId)} → ${nameOf(proofViewing.receiverId)}`
            : undefined
        }
      />

      {/* ---- Reject ---- */}
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent variant="centered" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment not received?</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {rejecting && nameOf(rejecting.payerId)} will be told this{' '}
              {formatPaise(rejecting?.amountPaise ?? 0)} payment was not confirmed. The
              balance stays as it is.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Optional: explain what happened"
              rows={3}
              aria-label="Reason"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(busyId)}
              onClick={() => rejecting && void act(rejecting, 'reject', rejectReason)}
            >
              {busyId ? 'Saving…' : 'Mark not received'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {activeGroupId && (
        <SettleDialog
          open={settling !== null}
          onOpenChange={(next) => !next && setSettling(null)}
          groupId={activeGroupId}
          counterpart={settling}
          groupName={activeGroup?.name}
          onSettled={() => {
            setSettling(null);
            setPlanKey((key) => key + 1);
            void load();
          }}
        />
      )}
      {/* Deep-linkable: a notification can point straight at one settlement. */}
      <SettlementDetail
        open={detailSettlement !== null}
        onOpenChange={(next) => !next && openDetail(null)}
        settlement={detailSettlement}
        groupName={activeGroup?.name ?? ''}
        nameOf={nameOf}
        counterpart={
          detailSettlement
            ? (members.find(
                (member) =>
                  member.id ===
                  (detailSettlement.payerId === user?.id
                    ? detailSettlement.receiverId
                    : detailSettlement.payerId),
              ) ?? null)
            : null
        }
        outstandingPaise={outstandingPaise}
        isBusy={busyId === detailSettlement?.id}
        canApprove={
          detailSettlement?.receiverId === user?.id &&
          detailSettlement?.status === 'paid_pending_approval'
        }
        canCancel={
          Boolean(detailSettlement) &&
          (detailSettlement!.payerId === user?.id ||
            detailSettlement!.receiverId === user?.id) &&
          ['paid_pending_approval', 'rejected'].includes(detailSettlement!.status)
        }
        onApprove={() => detailSettlement && void act(detailSettlement, 'approve')}
        onReject={() => {
          if (detailSettlement) setRejecting(detailSettlement);
          openDetail(null);
        }}
        onCancel={() => detailSettlement && void act(detailSettlement, 'cancel')}
        onViewProof={() => {
          if (detailSettlement) setProofViewing(detailSettlement);
        }}
        onViewRelatedExpenses={() => {
          openDetail(null);
          navigate('/app/expenses');
        }}
      />
    </AppShell>
  );
};
