import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Receipt,
  ShieldOff,
  Users2,
  Wallet,
} from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { Chip, prettyStatus, settlementTone } from '../AdminChip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiClientError, apiRequest } from '@/lib/api';
import {
  listAdminActivity,
  listAdminGroups,
  listAdminSettlements,
  listAdminUsers,
  type AdminActivity,
  type AdminGroup,
  type AdminSettlement,
  type AdminUser,
} from '@/lib/adminApi';
import { formatPaise, formatPaiseCompact } from '@/lib/money';

/**
 * Platform overview.
 *
 * An operator opens this screen to answer one question: is anything wrong right now?
 * So it leads with conditions that need attention and only then shows the counts.
 * Everything here is composed from the existing admin endpoints -- stats, plus the
 * first page of each list -- rather than a new aggregate API, so no figure on this
 * screen can disagree with the screen it links to.
 */

interface Stats {
  users: { total: number; verified: number; admins: number; disabled?: number };
  groups: { total: number; active30Days: number; disabled?: number };
  expenses: { total: number; totalValuePaise: number };
  settlements: { pending: number; completedValuePaise: number };
}

interface OverviewData {
  stats: Stats;
  users: AdminUser[];
  groups: AdminGroup[];
  settlements: AdminSettlement[];
  activity: AdminActivity[];
}

const RECENT_LIMIT = 5;

/* ------------------------------------------------------------------ metric tiles */

const Metric: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  tone?: 'default' | 'warning';
}> = ({ label, value, hint, icon: Icon, to, tone = 'default' }) => (
  <Link
    to={to}
    className={cn(
      'group block rounded-admin border bg-admin-chrome p-3.5 transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      tone === 'warning'
        ? 'border-amber-500/40 hover:border-amber-500/70'
        : 'border-admin-border hover:border-primary/50',
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <Icon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          tone === 'warning' ? 'text-amber-500' : 'text-muted-foreground/60',
        )}
      />
    </div>
    <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums tracking-tight">
      {value}
    </p>
    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
      <span className="min-w-0 truncate">{hint ?? 'View'}</span>
      <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
    </p>
  </Link>
);

/* ------------------------------------------------------------------ panels */

const Panel: React.FC<{
  title: string;
  to: string;
  linkLabel?: string;
  children: React.ReactNode;
}> = ({ title, to, linkLabel = 'View all', children }) => (
  <section className="flex min-w-0 flex-col overflow-hidden rounded-admin border border-admin-border bg-admin-chrome">
    <div className="flex items-center justify-between gap-2 border-b border-admin-border px-3.5 py-2.5">
      <h2 className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <Link
        to={to}
        // Full tap target, pulled back with negative margin so the panel header keeps
        // its compact height.
        className="-my-3 inline-flex min-h-[44px] shrink-0 items-center rounded px-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {linkLabel}
      </Link>
    </div>
    <div className="min-w-0 flex-1">{children}</div>
  </section>
);

const PanelEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-3.5 py-8 text-center text-sm text-muted-foreground">{children}</p>
);

/** One line in a panel: a label, a supporting line, and a trailing figure or chip. */
const PanelRow: React.FC<{
  to: string;
  title: string;
  subtitle: string;
  trailing: React.ReactNode;
}> = ({ to, title, subtitle, trailing }) => (
  <Link
    to={to}
    className="flex min-h-[48px] items-center gap-3 border-b border-admin-border px-3.5 py-2 transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:bg-accent"
  >
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{title}</span>
      <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
    </span>
    <span className="shrink-0 text-right">{trailing}</span>
  </Link>
);

const shortDate = (value: string | null): string =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';

/* ------------------------------------------------------------------ screen */

export const AdminOverview: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const [stats, users, groups, settlements, activity] = await Promise.all([
        apiRequest<Stats>('/api/admin/stats', { signal }),
        listAdminUsers({ limit: RECENT_LIMIT, offset: 0 }),
        listAdminGroups({ limit: RECENT_LIMIT, offset: 0 }),
        listAdminSettlements({ limit: RECENT_LIMIT, offset: 0, status: 'all' }),
        listAdminActivity({ limit: 6, offset: 0 }),
      ]);
      if (signal?.aborted) return;
      setData({
        stats,
        users: users.users,
        groups: groups.groups,
        settlements: settlements.settlements,
        activity: activity.activities,
      });
    } catch (err: unknown) {
      if (signal?.aborted) return;
      setError(err instanceof ApiClientError ? err.message : 'Could not load the overview.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = () => {
    setIsRefreshing(true);
    void load();
  };

  const stats = data?.stats;

  // Conditions worth an operator's attention. Each one is a real state with a screen
  // behind it -- nothing here is decorative, and an empty list is itself the answer.
  const warnings: { label: string; detail: string; to: string }[] = [];
  if ((stats?.users.disabled ?? 0) > 0) {
    warnings.push({
      label: `${stats?.users.disabled} disabled account${stats?.users.disabled === 1 ? '' : 's'}`,
      detail: 'These people cannot sign in until an admin re-enables them.',
      to: '/admin/users',
    });
  }
  if ((stats?.groups.disabled ?? 0) > 0) {
    warnings.push({
      label: `${stats?.groups.disabled} disabled group${stats?.groups.disabled === 1 ? '' : 's'}`,
      detail: 'Members cannot add expenses or settle up in these groups.',
      to: '/admin/groups',
    });
  }
  if ((stats?.settlements.pending ?? 0) > 0) {
    warnings.push({
      label: `${stats?.settlements.pending} settlement${stats?.settlements.pending === 1 ? '' : 's'} awaiting confirmation`,
      detail: 'Someone has marked a payment as sent and is waiting to be confirmed.',
      to: '/admin/settlements',
    });
  }
  const unverified = (stats?.users.total ?? 0) - (stats?.users.verified ?? 0);
  if (unverified > 0) {
    warnings.push({
      label: `${unverified} unverified account${unverified === 1 ? '' : 's'}`,
      detail: 'Signed up but never confirmed their email address.',
      to: '/admin/users',
    });
  }

  return (
    <AdminLayout title="Overview">
      <AdminPageHeader
        title="Platform overview"
        description="Live state of every account, group and rupee on this deployment."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Overview' }]}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      {error ? (
        <div className="rounded-admin border border-admin-border bg-admin-chrome p-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-3 h-11" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <Skeleton key={index} className="h-[104px] rounded-admin" />
            ))}
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-56 rounded-admin" />
            ))}
          </div>
        </div>
      ) : (
        <div className={cn('space-y-6', isRefreshing && 'opacity-70 transition-opacity')}>
          {/* ---- Attention ---- */}
          <section>
            <h2 className="t-eyebrow mb-2">Needs attention</h2>
            {warnings.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-admin border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm">
                  Nothing needs attention. No disabled accounts or groups, no settlements
                  waiting, every account verified.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {warnings.map((warning) => (
                  <li key={warning.label}>
                    <Link
                      to={warning.to}
                      className="flex min-h-[56px] items-start gap-2.5 rounded-admin border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 transition-colors hover:border-amber-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{warning.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {warning.detail}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- Metrics ---- */}
          <section>
            <h2 className="t-eyebrow mb-2">Platform</h2>
            <div className="stagger-children grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Metric
                label="Users"
                value={String(stats?.users.total ?? 0)}
                hint={`${stats?.users.verified ?? 0} verified · ${stats?.users.admins ?? 0} admin`}
                icon={Users2}
                to="/admin/users"
              />
              <Metric
                label="Active users"
                value={String(stats?.users.verified ?? 0)}
                hint="Verified and able to sign in"
                icon={Users2}
                to="/admin/users"
              />
              <Metric
                label="Groups"
                value={String(stats?.groups.total ?? 0)}
                hint={`${stats?.groups.active30Days ?? 0} active in 30d`}
                icon={Users2}
                to="/admin/groups"
              />
              <Metric
                label="Active groups"
                value={String(stats?.groups.active30Days ?? 0)}
                hint="Used in the last 30 days"
                icon={Activity}
                to="/admin/groups"
              />
              <Metric
                label="Expenses"
                value={String(stats?.expenses.total ?? 0)}
                hint={`${formatPaiseCompact(stats?.expenses.totalValuePaise ?? 0)} logged`}
                icon={Receipt}
                to="/admin/expenses"
              />
              <Metric
                label="Settled"
                value={formatPaiseCompact(stats?.settlements.completedValuePaise ?? 0)}
                hint="Confirmed payments"
                icon={Wallet}
                to="/admin/settlements"
              />
              <Metric
                label="Pending settlements"
                value={String(stats?.settlements.pending ?? 0)}
                hint="Awaiting confirmation"
                icon={AlertTriangle}
                to="/admin/settlements"
                tone={(stats?.settlements.pending ?? 0) > 0 ? 'warning' : 'default'}
              />
              <Metric
                label="Disabled"
                value={`${stats?.users.disabled ?? 0} / ${stats?.groups.disabled ?? 0}`}
                hint="Accounts / groups"
                icon={ShieldOff}
                to="/admin/users"
                tone={
                  (stats?.users.disabled ?? 0) + (stats?.groups.disabled ?? 0) > 0
                    ? 'warning'
                    : 'default'
                }
              />
            </div>
          </section>

          {/* ---- Recent ---- */}
          <section>
            <h2 className="t-eyebrow mb-2">Recent</h2>
            <div className="grid gap-3 xl:grid-cols-2">
              <Panel title="Platform activity" to="/admin/activity">
                {!data || data.activity.length === 0 ? (
                  <PanelEmpty>Nothing has happened yet.</PanelEmpty>
                ) : (
                  data.activity.map((row) => (
                    <PanelRow
                      key={row.id}
                      to={`/admin/groups/${row.group.id}`}
                      title={`${row.actor.fullName} · ${row.type.replace(/_/g, ' ')}`}
                      subtitle={row.group.name}
                      trailing={
                        <span className="text-xs text-muted-foreground">
                          {shortDate(row.createdAt)}
                        </span>
                      }
                    />
                  ))
                )}
              </Panel>

              <Panel title="Newest accounts" to="/admin/users">
                {!data || data.users.length === 0 ? (
                  <PanelEmpty>No accounts yet.</PanelEmpty>
                ) : (
                  data.users.map((person) => (
                    <PanelRow
                      key={person.id}
                      to={`/admin/users/${person.id}`}
                      title={person.fullName}
                      subtitle={person.email}
                      trailing={
                        person.status === 'disabled' ? (
                          <Chip tone="bad">Disabled</Chip>
                        ) : person.role === 'admin' ? (
                          <Chip tone="info">Admin</Chip>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {shortDate(person.createdAt)}
                          </span>
                        )
                      }
                    />
                  ))
                )}
              </Panel>

              <Panel title="Newest groups" to="/admin/groups">
                {!data || data.groups.length === 0 ? (
                  <PanelEmpty>No groups yet.</PanelEmpty>
                ) : (
                  data.groups.map((group) => (
                    <PanelRow
                      key={group.id}
                      to={`/admin/groups/${group.id}`}
                      title={group.name}
                      subtitle={`${group.memberCount} member${group.memberCount === 1 ? '' : 's'} · ${group.creatorName}`}
                      trailing={
                        group.status === 'disabled' ? (
                          <Chip tone="bad">Disabled</Chip>
                        ) : (
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatPaiseCompact(group.totalValuePaise)}
                          </span>
                        )
                      }
                    />
                  ))
                )}
              </Panel>

              <Panel title="Latest settlements" to="/admin/settlements">
                {!data || data.settlements.length === 0 ? (
                  <PanelEmpty>No settlements recorded yet.</PanelEmpty>
                ) : (
                  data.settlements.map((settlement) => (
                    <PanelRow
                      key={settlement.id}
                      to="/admin/settlements"
                      title={`${settlement.payer.fullName} → ${settlement.receiver?.fullName ?? 'the group'}`}
                      subtitle={`${settlement.group.name} · ${formatPaise(settlement.amountPaise)}`}
                      trailing={
                        <Chip tone={settlementTone(settlement.status)}>
                          {prettyStatus(settlement.status)}
                        </Chip>
                      }
                    />
                  ))
                )}
              </Panel>
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
};
