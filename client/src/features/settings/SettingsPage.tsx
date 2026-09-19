import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, CalendarClock, Crown, Loader2, LogOut, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { env } from '@/lib/env';
import { useGroups } from '@/context/GroupContext';
import { useAuth } from '@/context/AuthContext';
import { getGroup, leaveGroup, setPayday, deleteGroup } from '@/lib/domainApi';
import { PurgeHistoryDialog } from '@/features/groups/PurgeHistoryDialog';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { BillingCycle, PersonRef } from '@/types/domain';

/**
 * Group and personal settings.
 *
 * Payday is creator-only and drives the billing-cycle banner on the dashboard. Push
 * notifications are per-device, because a browser subscription belongs to that browser
 * and not to the account.
 */

const SettingsCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <h2 className="t-subtitle">{title}</h2>
    {description && <p className="mt-0.5 t-meta">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const ordinal = (day: number): string => {
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix}`;
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeGroup, activeGroupId, refreshGroups } = useGroups();
  const { can } = useAuth();

  const [billingCycle, setBillingCycle] = useState<BillingCycle | null>(null);
  const [payday, setPaydayValue] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPayday, setIsSavingPayday] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const push = usePushNotifications();
  const isCreator = activeGroup?.role === 'creator';
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [members, setMembers] = useState<PersonRef[]>([]);

  useEffect(() => {
    if (!activeGroupId) return;
    let cancelled = false;

    void getGroup(activeGroupId)
      .then((data) => {
        if (cancelled) return;
        setBillingCycle(data.billingCycle);
        setPaydayValue(data.group.payday ? String(data.group.payday) : 'none');
        setMembers(
          data.members.map((member) => ({
            id: member.id,
            fullName: member.fullName,
            email: member.email,
            upiId: member.upiId ?? null,
            qrCodeUrl: member.qrCodeUrl ?? null,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroupId]);

  const savePayday = async (value: string) => {
    if (!activeGroupId || isSavingPayday) return;
    setPaydayValue(value);
    setIsSavingPayday(true);

    try {
      const data = await setPayday(activeGroupId, value === 'none' ? null : Number(value));
      setBillingCycle(data.billingCycle);
      toast.success(
        value === 'none'
          ? 'Payday cleared'
          : `Payday set to the ${ordinal(Number(value))} of each month`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save the payday.');
    } finally {
      setIsSavingPayday(false);
    }
  };

  const handleLeave = async () => {
    if (!activeGroupId || isBusy) return;
    setIsBusy(true);
    try {
      const result = await leaveGroup(activeGroupId);
      toast.success(result.groupDeleted ? 'Group deleted' : 'You left the group');
      await refreshGroups();
      navigate('/app');
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'Could not leave the group.',
        {
          description:
            err instanceof ApiClientError && err.code === 'OUTSTANDING_BALANCE'
              ? 'Settle your balances with everyone first.'
              : undefined,
        },
      );
    } finally {
      setIsBusy(false);
      setLeaveOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!activeGroupId || isBusy) return;
    setIsBusy(true);
    try {
      await deleteGroup(activeGroupId);
      toast.success('Group deleted');
      await refreshGroups();
      navigate('/app');
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete the group.');
    } finally {
      setIsBusy(false);
      setDeleteOpen(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">
        {/* ---- Payday ---- */}
        <SettingsCard
          title="Monthly payday"
          description="Sets the billing cycle shown on the dashboard, so everyone knows when dues are expected."
        >
          {isLoading ? (
            <Skeleton className="h-11 w-full rounded-lg" />
          ) : !isCreator ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
              <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-slate-600">
                {billingCycle?.payday
                  ? `Payday is the ${ordinal(billingCycle.payday)} of each month.`
                  : 'No payday is set for this group.'}{' '}
                <span className="text-slate-400">Only the group creator can change this.</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="payday-select">Day of the month</Label>
                <Select value={payday} onValueChange={savePayday} disabled={isSavingPayday}>
                  <SelectTrigger id="payday-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No payday</SelectItem>
                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>
                        {ordinal(day)} of every month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Months are shorter than 31 days, so say what actually happens. */}
                {Number(payday) > 28 && (
                  <p className="t-meta">
                    In shorter months this falls on the last day instead.
                  </p>
                )}
              </div>

              {billingCycle?.payday && (
                <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 p-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">
                      Next payday: {billingCycle.nextPayday}
                    </p>
                    <p className="t-meta">
                      {billingCycle.daysRemaining === 0
                        ? 'That is today.'
                        : `${billingCycle.daysRemaining} days away.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </SettingsCard>

        {/* ---- Push notifications ---- */}
        <SettingsCard
          title="Push notifications"
          description="Get alerted about new expenses and payments even when SplitWise is closed."
        >
          {!push.isSupported ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              This browser does not support push notifications.
            </p>
          ) : !env.pushEnabled ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Push is not configured on this deployment. Set{' '}
              <code className="rounded bg-slate-200 px-1 text-xs">VITE_VAPID_PUBLIC_KEY</code>{' '}
              and the matching server keys to enable it.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {push.isSubscribed ? 'Enabled on this device' : 'Disabled'}
                </p>
                <p className="t-meta">
                  {push.permission === 'denied'
                    ? 'Blocked in your browser settings — re-enable it there first.'
                    : 'Push is per-device, so enable it on each browser you use.'}
                </p>
              </div>
              <Button
                variant={push.isSubscribed ? 'outline' : 'default'}
                onClick={() => void push.toggle()}
                disabled={push.isBusy || push.permission === 'denied'}
                className="shrink-0"
              >
                {push.isBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : push.isSubscribed ? (
                  <BellOff className="mr-2 h-4 w-4" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                {push.isBusy ? 'Working…' : push.isSubscribed ? 'Turn off' : 'Turn on'}
              </Button>
            </div>
          )}
        </SettingsCard>

        {/* ---- Clear history (creator only; the server enforces it too) ---- */}
        {isCreator && can('history.purge') && (
          <SettingsCard
            title="Clear history"
            description="Permanently delete a date range of expenses and payments from this group."
          >
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Only periods that are fully settled can be cleared, so this can never
                change what anyone owes. You will see exactly what would be deleted
                before anything is.
              </p>
              <Button
                variant="outline"
                onClick={() => setPurgeOpen(true)}
                className="text-destructive hover:bg-red-50 sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear history&hellip;
              </Button>
            </div>
          </SettingsCard>
        )}

        {/* ---- Danger zone ---- */}
        <SettingsCard
          title="Leaving this group"
          description="You can only leave once you have settled up with everyone."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setLeaveOpen(true)}
              className="sm:w-auto"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Leave group
            </Button>
            {isCreator && (
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className={cn('text-destructive hover:bg-red-50 sm:w-auto')}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete group
              </Button>
            )}
          </div>
        </SettingsCard>
      </div>

      {/* ---- Leave ---- */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent variant="centered" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave {activeGroup?.name}?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm leading-relaxed text-slate-600">
              You will lose access to this group&apos;s expenses. If you still owe or are owed
              anything, the server will block this until you settle up.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeave} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isBusy ? 'Leaving…' : 'Leave group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete ---- */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent variant="centered" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {activeGroup?.name}?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm leading-relaxed text-slate-600">
              Every expense, settlement and balance in this group will be permanently
              deleted for all members. This cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isBusy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {activeGroupId && activeGroup && (
        <PurgeHistoryDialog
          open={purgeOpen}
          onOpenChange={setPurgeOpen}
          groupId={activeGroupId}
          groupName={activeGroup.name}
          members={members}
          onPurged={() => {
            toast.success('History cleared.');
            void refreshGroups();
          }}
        />
      )}

    </AppShell>
  );
};
