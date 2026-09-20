import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Crown,
  Loader2,
  ShieldCheck,
  UserMinus,
  Users2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ApiClientError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupContext';
import { useRealtime } from '@/hooks/useRealtime';
import { getGroup, getOutstanding, removeMember } from '@/lib/domainApi';
import { formatPaise } from '@/lib/money';
import { formatRelativeDate } from '@/lib/dateRange';
import type {
  Expense,
  GroupMemberSummary,
  RelationshipRow,
  Settlement,
} from '@/types/domain';
import { SettleDialog } from '@/features/settlements/SettleDialog';

/**
 * Members and dues.
 *
 * The list shows each member's live position. Selecting one opens a per-person history:
 * exactly what is outstanding in each direction right now, the expenses shared with
 * them, and the settlements exchanged. The two directions are always shown separately --
 * this product never nets A-owes-B against B-owes-A.
 */

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

interface MemberDetail {
  iOwePaise: number;
  theyOwePaise: number;
  expenses: Expense[];
  settlements: Settlement[];
  relationship: RelationshipRow | null;
}

const MemberRowSkeleton: React.FC = () => (
  <li className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
    <Skeleton className="h-11 w-11 rounded-full" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="h-4 w-20" />
  </li>
);

export const MembersPage: React.FC = () => {
  const { user } = useAuth();
  const { activeGroup, activeGroupId, refreshGroups } = useGroups();

  const [members, setMembers] = useState<GroupMemberSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<GroupMemberSummary | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [settleTarget, setSettleTarget] = useState<GroupMemberSummary | null>(null);
  const [removing, setRemoving] = useState<GroupMemberSummary | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const isCreator = activeGroup?.role === 'creator';

  const loadMembers = useCallback(async () => {
    if (!activeGroupId) return;
    setError(null);
    try {
      const data = await getGroup(activeGroupId);
      setMembers(data.members);
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load members.');
    } finally {
      setIsLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useRealtime(
    activeGroupId,
    useCallback(() => void loadMembers(), [loadMembers]),
  );

  /** Loads one member's full history. Four scoped requests, run in parallel. */
  const openMember = async (member: GroupMemberSummary) => {
    if (!activeGroupId) return;
    setSelected(member);
    setDetail(null);
    setIsDetailLoading(true);

    try {
      const [outstanding, expenseData, settlementData, relationshipData] = await Promise.all([
        getOutstanding(activeGroupId, member.id),
        apiRequest<{ expenses: Expense[] }>(
          `/api/groups/${activeGroupId}/expenses?memberId=${member.id}&involvement=involving_me&limit=20`,
        ),
        apiRequest<{ settlements: Settlement[] }>(
          `/api/groups/${activeGroupId}/settlements?limit=50`,
        ),
        apiRequest<{ relationships: RelationshipRow[] }>(
          `/api/groups/${activeGroupId}/reports/relationships`,
        ),
      ]);

      setDetail({
        iOwePaise: outstanding.iOwePaise,
        theyOwePaise: outstanding.theyOwePaise,
        expenses: expenseData.expenses,
        // Only settlements between the viewer and this member.
        settlements: settlementData.settlements.filter(
          (settlement) =>
            (settlement.payerId === member.id && settlement.receiverId === user?.id) ||
            (settlement.receiverId === member.id && settlement.payerId === user?.id),
        ),
        relationship:
          relationshipData.relationships.find((row) => row.person.id === member.id) ?? null,
      });
    } catch {
      toast.error('Could not load that member&apos;s history.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!removing || !activeGroupId || isRemoving) return;
    setIsRemoving(true);
    try {
      await removeMember(activeGroupId, removing.id);
      toast.success(`${removing.fullName} was removed from the group`);
      setRemoving(null);
      await loadMembers();
      await refreshGroups();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'Could not remove that member.',
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const sorted = useMemo(
    () =>
      [...(members ?? [])].sort((a, b) => {
        // Live exposure first, then creators, then name.
        const aLive = a.owesPaise + a.receivesPaise;
        const bLive = b.owesPaise + b.receivesPaise;
        if (aLive !== bLive) return bLive - aLive;
        if (a.role !== b.role) return a.role === 'creator' ? -1 : 1;
        return a.fullName.localeCompare(b.fullName);
      }),
    [members],
  );

  return (
    <AppShell title="Members & Dues">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Users2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="t-subtitle">
            {members?.length ?? 0} {members?.length === 1 ? 'member' : 'members'}
          </h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={loadMembers}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <ul>
              {[0, 1, 2].map((index) => (
                <MemberRowSkeleton key={index} />
              ))}
            </ul>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-lg shadow-emerald-950/30">
                <Users2 className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="mt-2 text-base font-semibold text-slate-100">
                No other members yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">
                Share your group invite link or QR code to bring people in and start splitting expenses.
              </p>
            </div>
          ) : (
            <ul>
              {sorted.map((member) => {
                const isMe = member.id === user?.id;
                const net = member.netPaise;
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
                  >
                    <button
                      type="button"
                      onClick={() => void openMember(member)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarFallback className="bg-[#1F2937] text-slate-200 border border-white/[0.08] font-semibold text-xs">
                          {initials(member.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                          <span className="truncate">
                            {member.fullName}
                            {isMe && ' (you)'}
                          </span>
                          {member.role === 'creator' && (
                            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          )}
                        </p>
                        <p className="truncate t-meta">{member.email}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {net === 0 ? (
                          <span className="t-meta">Settled up</span>
                        ) : (
                          <span
                            className={cn(
                              't-money text-sm',
                              net > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                            )}
                          >
                            {net > 0 ? '+' : '−'}
                            {formatPaise(Math.abs(net))}
                          </span>
                        )}
                      </div>
                    </button>

                    {isCreator && !isMe && (
                      <button
                        type="button"
                        onClick={() => setRemoving(member)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-destructive"
                        aria-label={`Remove ${member.fullName}`}
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="px-1 t-meta">
          The figure on the right is each member&apos;s net position across the whole group.
          Tap a member to see exactly what is outstanding between the two of you.
        </p>
      </div>

      {/* ---- Member detail ---- */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent variant="sheet" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.fullName}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {isDetailLoading ? (
              <>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </>
            ) : (
              detail && (
                <>
                  {/* Both directions, never netted. */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center">
                      <ArrowUpRight className="mx-auto h-4 w-4 text-red-500" />
                      <p className="mt-1 t-eyebrow">You owe</p>
                      <p className="t-money mt-0.5 text-lg text-red-700 dark:text-red-400">
                        {formatPaise(detail.iOwePaise)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                      <ArrowDownLeft className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="mt-1 t-eyebrow">They owe</p>
                      <p className="t-money mt-0.5 text-lg text-emerald-700 dark:text-emerald-400">
                        {formatPaise(detail.theyOwePaise)}
                      </p>
                    </div>
                  </div>

                  {detail.iOwePaise > 0 && selected && (
                    <Button
                      className="w-full"
                      onClick={() => {
                        setSettleTarget(selected);
                        setSelected(null);
                      }}
                    >
                      Settle {formatPaise(detail.iOwePaise)}
                    </Button>
                  )}

                  {detail.relationship && (
                    <div className="rounded-xl bg-muted p-3">
                      <p className="t-eyebrow mb-2">Historical attribution</p>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">I paid for them</dt>
                          <dd className="t-money text-foreground">
                            {formatPaise(detail.relationship.iPaidForThem.paise)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">They paid for me</dt>
                          <dd className="t-money text-foreground">
                            {formatPaise(detail.relationship.theyPaidForMe.paise)}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        What was spent historically — not the same as what is owed today.
                      </p>
                    </div>
                  )}

                  {/* Settlements between us */}
                  <div>
                    <p className="t-eyebrow mb-2">Settlements between you</p>
                    {detail.settlements.length === 0 ? (
                      <p className="rounded-xl bg-muted px-3 py-4 text-center t-meta">
                        No settlements yet.
                      </p>
                    ) : (
                      <ul className="overflow-hidden rounded-xl border border-border">
                        {detail.settlements.slice(0, 8).map((settlement) => (
                          <li
                            key={settlement.id}
                            className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 first:border-t-0"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {settlement.payerId === user?.id ? 'You paid' : 'They paid'}
                              </p>
                              <p className="t-meta">
                                {settlement.status === 'completed'
                                  ? 'Confirmed'
                                  : settlement.status === 'paid_pending_approval'
                                    ? 'Awaiting confirmation'
                                    : settlement.status === 'rejected'
                                      ? 'Not confirmed'
                                      : settlement.status === 'will_pay_soon'
                                        ? 'Promised'
                                        : 'Cancelled'}
                              </p>
                            </div>
                            <span
                              className={cn(
                                't-money shrink-0 text-sm',
                                settlement.status === 'completed'
                                  ? 'text-foreground'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {formatPaise(settlement.amountPaise)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Shared expenses */}
                  <div>
                    <p className="t-eyebrow mb-2">Expenses you both share</p>
                    {detail.expenses.length === 0 ? (
                      <p className="rounded-xl bg-muted px-3 py-4 text-center t-meta">
                        No shared expenses.
                      </p>
                    ) : (
                      <ul className="overflow-hidden rounded-xl border border-border">
                        {detail.expenses.slice(0, 10).map((expense) => (
                          <li
                            key={expense.id}
                            className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 first:border-t-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {expense.title}
                              </p>
                              <p className="t-meta">
                                {formatRelativeDate(expense.expenseDate)} ·{' '}
                                {expense.paidBy === user?.id ? 'you paid' : 'they paid'}
                              </p>
                            </div>
                            <span className="t-money shrink-0 text-sm text-foreground">
                              {formatPaise(expense.amountPaise)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Settle ---- */}
      <SettleDialog
        open={Boolean(settleTarget)}
        onOpenChange={(open) => !open && setSettleTarget(null)}
        groupId={activeGroupId ?? ''}
        groupName={activeGroup?.name}
        counterpart={
          settleTarget
            ? {
                id: settleTarget.id,
                fullName: settleTarget.fullName,
                email: settleTarget.email,
                upiId: settleTarget.upiId,
                qrCodeUrl: settleTarget.qrCodeUrl,
              }
            : null
        }
        onSettled={() => {
          toast.success('Payment recorded — waiting for confirmation');
          void loadMembers();
        }}
      />

      {/* ---- Remove member ---- */}
      <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent variant="centered" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {removing?.fullName}?</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              They will lose access to this group. Past expenses they were part of stay
              exactly as they are.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-300">
                A member with outstanding balances cannot be removed — the server checks
                this, so settle up with them first.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={isRemoving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRemoving ? 'Removing…' : 'Remove member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
