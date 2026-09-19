import React, { useCallback, useEffect, useState } from 'react';
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
    className: 'bg-emerald-100 text-emerald-800',
    affectsBalance: true,
  },
  paid_pending_approval: {
    label: 'Awaiting confirmation',
    className: 'bg-amber-100 text-amber-800',
    affectsBalance: false,
  },
  will_pay_soon: {
    label: 'Promised',
    className: 'bg-sky-100 text-sky-800',
    affectsBalance: false,
  },
  rejected: {
    label: 'Not confirmed',
    className: 'bg-red-100 text-red-800',
    affectsBalance: false,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-slate-100 text-slate-600',
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

  const [status, setStatus] = useState<SettlementStatus | 'all'>('all');
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
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity',
            isRefreshing && !isLoading && 'opacity-70',
          )}
        >
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-600">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={load}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <ul>
              {[0, 1, 2, 3].map((index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0"
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
              <History className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No settlements {status !== 'all' && 'with this status'}
              </p>
              <p className="mx-auto mt-1 max-w-xs t-meta">
                Settlements appear here once someone records a payment.
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
                  <li key={settlement.id} className="border-t border-slate-100 first:border-t-0">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-slate-100 text-slate-600">
                          {initials(nameOf(settlement.payerId))}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
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
                          <button
                            type="button"
                            onClick={() => setProofViewing(settlement)}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            View payment proof
                          </button>
                        )}
                        {settlement.rejectionReason && (
                          <p className="mt-1 text-xs text-red-600">
                            {settlement.rejectionReason}
                          </p>
                        )}
                        {/* The single most important fact about a settlement row. */}
                        {!meta.affectsBalance && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Does not affect balances
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            't-money text-sm',
                            meta.affectsBalance ? 'text-slate-900' : 'text-slate-400',
                          )}
                        >
                          {formatPaise(settlement.amountPaise)}
                        </p>
                      </div>
                    </div>

                    {(canApprove || canCancel) && (
                      <div className="flex flex-wrap gap-2 border-t border-slate-50 bg-slate-50/60 px-4 py-2.5">
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
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
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
            <p className="text-sm leading-relaxed text-slate-600">
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
    </AppShell>
  );
};
