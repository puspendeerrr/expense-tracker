import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Crown, Power, PowerOff, Trash2, UserMinus } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { PurgeHistoryDialog } from '@/features/groups/PurgeHistoryDialog';
import { Chip } from '../AdminChip';
import { ConfirmDialog } from '../ConfirmDialog';
import { RowActions } from '../DataView';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/hooks/useRealtime';
import {
  disableGroup,
  enableGroup,
  getAdminGroupDetail,
  removeGroupMember,
  transferGroupCreator,
  adminPreviewPurge,
  adminExecutePurge,
  type AdminGroupDetail as GroupDetail,
} from '@/lib/adminApi';
import { formatPaise } from '@/lib/money';
import { AdminGroupExpenses } from './panels/AdminGroupExpenses';
import { AdminGroupSettlements } from './panels/AdminGroupSettlements';
import { AdminGroupActivity } from './panels/AdminGroupActivity';
import { AdminGroupReports } from './panels/AdminGroupReports';

/**
 * Group control centre.
 *
 * The overview reads its debts from the admin group endpoint, which in turn reads the
 * balance engine, so this screen and the members' own dashboard can never disagree.
 * Realtime keeps it current: any change in the group re-fetches rather than reloading
 * the page.
 */

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-admin-border bg-admin-chrome p-3">
    <p className="font-mono text-base font-bold tabular-nums">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

export const AdminGroupDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can('admin.groups.manage');

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);

  // Holding the console is not by itself permission to destroy financial history; the
  // server requires both, and this mirrors that rather than inventing a rule.
  const canPurge = canManage && can('history.purge');

  const [confirm, setConfirm] = useState<
    | { kind: 'disable' | 'enable' }
    | { kind: 'transfer'; userId: string; name: string }
    | { kind: 'remove'; userId: string; name: string }
    | null
  >(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setError(null);
      try {
        const data = await getAdminGroupDetail(id, signal);
        if (!signal?.aborted) setDetail(data);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        setError(err instanceof ApiClientError ? err.message : 'Could not load that group.');
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Targeted refresh rather than a reload: anything happening in this group matters here.
  useRealtime(
    id || null,
    useCallback(() => void load(), [load]),
  );

  const runConfirmed = async () => {
    if (!confirm || isBusy || !detail) return;
    setIsBusy(true);
    try {
      if (confirm.kind === 'disable') {
        await disableGroup(id);
        toast.success('Group is now read-only.');
      } else if (confirm.kind === 'enable') {
        await enableGroup(id);
        toast.success('Group re-enabled.');
      } else if (confirm.kind === 'transfer') {
        await transferGroupCreator(id, confirm.userId);
        toast.success(`${confirm.name} now owns this group.`);
      } else if (confirm.kind === 'remove') {
        await removeGroupMember(id, confirm.userId);
        toast.success(`${confirm.name} removed.`);
      }
      setConfirm(null);
      await load();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'That action could not be completed.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Group" backTo="/admin/groups">
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-admin" />
          <Skeleton className="h-64 rounded-admin" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !detail) {
    return (
      <AdminLayout title="Group" backTo="/admin/groups">
        <div className="rounded-admin border border-admin-border bg-admin-chrome p-10 text-center">
          <p className="text-sm text-muted-foreground">{error ?? 'Group not found.'}</p>
          <Button variant="outline" className="mt-3 h-11" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={detail.group.name}
      backTo="/admin/groups"
    >
      <AdminPageHeader
        title={detail.group.name}
        description={`Created by ${detail.creator.fullName} · invite code ${detail.group.inviteCode}`}
        crumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Groups', to: '/admin/groups' },
          { label: detail.group.name },
        ]}
        actions={
          <>
            <Chip tone={detail.group.status === 'active' ? 'ok' : 'bad'}>
              {detail.group.status}
            </Chip>
            {canManage &&
              (detail.group.status === 'disabled' ? (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => setConfirm({ kind: 'enable' })}
                >
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                  Enable
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => setConfirm({ kind: 'disable' })}
                >
                  <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                  Disable
                </Button>
              ))}
          </>
        }
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ---- Overview ---- */}
        <TabsContent value="overview" className="space-y-4">
          <div className="stagger-children grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Members" value={String(detail.stats.memberCount)} />
            <Stat label="Expenses" value={String(detail.stats.expenseCount)} />
            <Stat label="Total value" value={formatPaise(detail.stats.expenseValuePaise)} />
            <Stat label="Settled" value={formatPaise(detail.stats.settledValuePaise)} />
            <Stat label="Open debts" value={String(detail.stats.openDebtCount)} />
            <Stat label="Outstanding" value={formatPaise(detail.stats.openDebtValuePaise)} />
            <Stat label="Pending payments" value={String(detail.stats.pendingSettlements)} />
            <Stat label="Activity entries" value={String(detail.stats.activityCount)} />
          </div>

          <section className="overflow-hidden rounded-admin border border-admin-border bg-admin-chrome">
            <div className="border-b border-admin-border px-4 py-3">
              <h2 className="text-sm font-bold">Who owes whom</h2>
              <p className="text-xs text-muted-foreground">
                Directional and un-netted, straight from the balance engine.
              </p>
            </div>
            {detail.debts.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Everyone is settled up.
              </p>
            ) : (
              <ul>
                {detail.debts.map((debt, index) => (
                  <li
                    key={`${debt.debtorId}-${debt.creditorId}`}
                    className={cn(
                      'flex items-center justify-between gap-3 px-4 py-2.5',
                      index > 0 && 'border-t border-admin-border',
                    )}
                  >
                    <span className="min-w-0 truncate text-sm">
                      {debt.debtorName} &rarr; {debt.creditorName}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                      {formatPaise(debt.owedPaise)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* ---- Members ---- */}
        <TabsContent value="members">
          <div className="overflow-hidden rounded-admin border border-admin-border bg-admin-chrome">
            <ul>
              {detail.members.map((member, index) => (
                <li
                  key={member.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    index > 0 && 'border-t border-admin-border',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{member.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {member.role === 'creator' && <Chip tone="info">owner</Chip>}
                    {member.status === 'disabled' && <Chip tone="bad">disabled</Chip>}
                    {canManage && (
                      <RowActions
                        label={member.fullName}
                        actions={[
                          {
                            label: 'Make group owner',
                            icon: Crown,
                            disabled: member.role === 'creator' || member.status === 'disabled',
                            disabledReason:
                              member.role === 'creator'
                                ? 'Already the owner'
                                : 'Disabled accounts cannot own a group',
                            onSelect: () =>
                              setConfirm({
                                kind: 'transfer',
                                userId: member.id,
                                name: member.fullName,
                              }),
                          },
                          {
                            label: 'Remove from group',
                            icon: UserMinus,
                            destructive: true,
                            disabled: member.role === 'creator',
                            disabledReason: 'Transfer ownership first',
                            onSelect: () =>
                              setConfirm({
                                kind: 'remove',
                                userId: member.id,
                                name: member.fullName,
                              }),
                          },
                        ]}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <AdminGroupExpenses groupId={id} onChanged={() => void load()} />
        </TabsContent>

        <TabsContent value="settlements">
          <AdminGroupSettlements groupId={id} onChanged={() => void load()} />
        </TabsContent>

        <TabsContent value="activity">
          <AdminGroupActivity groupId={id} />
        </TabsContent>

        <TabsContent value="reports">
          <AdminGroupReports groupId={id} groupName={detail.group.name} />
        </TabsContent>

        {/* ---- Settings ---- */}
        <TabsContent value="settings" className="space-y-3">
          <section className="rounded-admin border border-admin-border bg-admin-chrome p-4">
            <h2 className="text-sm font-bold">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ['Owner', `${detail.creator.fullName} (${detail.creator.email})`],
                ['Invite code', detail.group.inviteCode],
                ['Payday', detail.group.payday ? `${detail.group.payday} of each month` : 'Not set'],
                ['Created', new Date(detail.group.createdAt).toLocaleDateString('en-IN')],
                ['Status', detail.group.status],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* The one irreversible action in the console, so it is walled off in its
              own destructive-bordered section rather than sitting among the settings. */}
          <section className="rounded-admin border border-destructive/30 bg-admin-chrome p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-destructive">
              <Trash2 className="h-4 w-4" />
              Clear history
            </h2>
            <p className="mt-1.5 max-w-prose text-xs text-muted-foreground">
              Permanently deletes expenses, settlements and activity in a date range for
              every member of this group. You will see exactly what would go before
              anything is deleted, and the range is refused outright if removing it would
              change anyone&rsquo;s balance &mdash; being an administrator does not waive
              that rule.
            </p>
            {canPurge ? (
              <Button
                variant="destructive"
                className="mt-3"
                onClick={() => setIsPurgeOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear history&hellip;
              </Button>
            ) : (
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                Requires the &ldquo;history.purge&rdquo; permission, which you do not hold.
              </p>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {detail && (
        <PurgeHistoryDialog
          open={isPurgeOpen}
          onOpenChange={setIsPurgeOpen}
          groupId={detail.group.id}
          groupName={detail.group.name}
          members={detail.members.map((member) => ({
            id: member.id,
            fullName: member.fullName,
            email: member.email,
          }))}
          api={{ preview: adminPreviewPurge, execute: adminExecutePurge }}
          onPurged={() => void load()}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        isBusy={isBusy}
        onConfirm={() => void runConfirmed()}
        destructive={confirm?.kind !== 'enable' && confirm?.kind !== 'transfer'}
        confirmLabel={
          confirm?.kind === 'transfer'
            ? 'Transfer ownership'
            : confirm?.kind === 'remove'
              ? 'Remove'
              : confirm?.kind === 'enable'
                ? 'Enable'
                : 'Disable'
        }
        title={
          confirm?.kind === 'transfer'
            ? `Make ${confirm.name} the owner?`
            : confirm?.kind === 'remove'
              ? `Remove ${confirm.name}?`
              : confirm?.kind === 'enable'
                ? 'Enable this group?'
                : 'Disable this group?'
        }
        description={
          confirm?.kind === 'transfer'
            ? 'They gain full control of the group, including its payday and invite. The current owner becomes an ordinary member.'
            : confirm?.kind === 'remove'
              ? 'They lose access to the group. This is refused if they still owe or are owed money, so no debt is orphaned.'
              : confirm?.kind === 'enable'
                ? 'Members will be able to add expenses and record payments again.'
                : 'The group stays readable and exportable for its members, but accepts no new writes.'
        }
      />
    </AdminLayout>
  );
};
