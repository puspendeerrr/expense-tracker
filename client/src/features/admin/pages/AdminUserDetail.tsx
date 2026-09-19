import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound, Shield } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { Chip } from '../AdminChip';
import { UserActionsDialog } from '../UserActionsDialog';
import { UserPermissionsDialog } from '../UserPermissionsDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  getUserPermissions,
  listAdminUsers,
  type AdminUser,
  type DashboardScope,
  type PermissionDefinition,
} from '@/lib/adminApi';

/**
 * One account, in full.
 *
 * The security-relevant facts are grouped together deliberately: verification, live
 * session count, disabled reason and the permission overrides are what an administrator
 * is actually looking for when they open a single user.
 *
 * There is no credential anywhere on this screen, and no way to reveal one. Resetting a
 * password sets a new value; it never displays the old.
 */

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-right text-sm font-medium">{children}</dd>
  </div>
);

export const AdminUserDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { user: me, can } = useAuth();

  const [person, setPerson] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [registry, setRegistry] = useState<PermissionDefinition[]>([]);
  const [scope, setScope] = useState<DashboardScope>({ kind: 'none' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      // The list endpoint is the only place a single admin user row is exposed; search
      // by id is not offered, so the row is located from a small page.
      const [list, perms] = await Promise.all([
        listAdminUsers({ limit: 100, offset: 0, role: 'all', verified: 'all' }),
        getUserPermissions(id),
      ]);

      setPerson(list.users.find((row) => row.id === id) ?? null);
      setPermissions(perms.permissions);
      setRegistry(perms.registry);
      setScope(perms.dashboardScope);
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load that account.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <AdminLayout title="User" backTo="/admin/users">
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-admin" />
          <Skeleton className="h-64 rounded-admin" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !person) {
    return (
      <AdminLayout title="User" backTo="/admin/users">
        <div className="rounded-admin border border-admin-border bg-admin-chrome p-10 text-center">
          <p className="text-sm text-muted-foreground">{error ?? 'Account not found.'}</p>
          <Button variant="outline" className="mt-3 h-11" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const held = registry.filter((permission) => permissions.includes(permission.key));
  const withheld = registry.filter((permission) => !permissions.includes(permission.key));

  return (
    <AdminLayout
      title={person.fullName}
      backTo="/admin/users"
    >
      <AdminPageHeader
        title={person.fullName}
        description={person.email}
        crumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Users', to: '/admin/users' },
          { label: person.fullName },
        ]}
        actions={
          <>
            <Chip tone={person.status === 'active' ? 'ok' : 'bad'}>{person.status}</Chip>
            <Chip tone={person.role === 'admin' ? 'info' : 'neutral'}>{person.role}</Chip>
            {can('admin.permissions.manage') && (
              <Button variant="outline" className="h-11" onClick={() => setPermissionsOpen(true)}>
                <Shield className="mr-1.5 h-3.5 w-3.5" />
                Permissions
              </Button>
            )}
            {can('admin.users.manage') && (
              <Button className="h-11" onClick={() => setActionsOpen(true)}>
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                Manage
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <section className="rounded-admin border border-admin-border bg-admin-chrome px-4 py-2">
            <dl className="divide-y divide-border">
              <Row label="Email">{person.email}</Row>
              <Row label="Verified">{person.isVerified ? 'Yes' : 'No'}</Row>
              <Row label="Groups">{person.groupCount}</Row>
              <Row label="Expenses paid">{person.expenseCount}</Row>
              <Row label="Active sessions">
                <span className={cn(person.activeSessions > 0 && 'text-primary')}>
                  {person.activeSessions}
                </span>
              </Row>
              <Row label="UPI ID">{person.upiId ?? '—'}</Row>
              <Row label="Joined">
                {person.createdAt
                  ? new Date(person.createdAt).toLocaleDateString('en-IN')
                  : '—'}
              </Row>
              {person.status === 'disabled' && (
                <Row label="Disabled reason">{person.disabledReason ?? 'Not recorded'}</Row>
              )}
            </dl>
          </section>

          {person.id === me?.id && (
            <p className="rounded-xl border border-amber-500/30 bg-admin-chrome p-3 text-xs text-muted-foreground">
              This is your own account. Actions that would lock you out are disabled.
            </p>
          )}
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-3">
          {person.role === 'admin' ? (
            <p className="rounded-xl border border-admin-border bg-admin-chrome p-4 text-sm text-muted-foreground">
              Administrators hold every capability by role. Change the role to manage them
              individually.
            </p>
          ) : (
            <>
              <section className="overflow-hidden rounded-admin border border-admin-border bg-admin-chrome">
                <div className="border-b border-admin-border px-4 py-2.5">
                  <h2 className="text-sm font-bold">Can do ({held.length})</h2>
                </div>
                <ul className="divide-y divide-border">
                  {held.map((permission) => (
                    <li key={permission.key} className="px-4 py-2">
                      <p className="text-sm font-medium">{permission.label}</p>
                      <p className="text-xs text-muted-foreground">{permission.description}</p>
                    </li>
                  ))}
                </ul>
              </section>

              {withheld.length > 0 && (
                <section className="overflow-hidden rounded-admin border border-admin-border bg-admin-chrome">
                  <div className="border-b border-admin-border px-4 py-2.5">
                    <h2 className="text-sm font-bold text-muted-foreground">
                      Cannot do ({withheld.length})
                    </h2>
                  </div>
                  <ul className="divide-y divide-border">
                    {withheld.map((permission) => (
                      <li key={permission.key} className="px-4 py-2">
                        <p className="text-sm text-muted-foreground">{permission.label}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {permissions.includes('dashboard.spending') && (
                <section className="rounded-admin border border-admin-border bg-admin-chrome p-4">
                  <h2 className="text-sm font-bold">Spending dashboard scope</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scope.kind === 'all_groups'
                      ? 'Every group on the platform.'
                      : scope.kind === 'selected_groups'
                        ? `${scope.groupIds?.length ?? 0} selected group(s).`
                        : 'No scope configured — they will see nothing.'}
                  </p>
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {/*
            Activity is group-scoped in the data model, so a per-user timeline would need
            its own endpoint. The platform activity screen filters by actor instead, and
            that is linked rather than half-built here.
          */}
          <p className="rounded-xl border border-admin-border bg-admin-chrome p-4 text-sm text-muted-foreground">
            Activity is recorded per group. Use the{' '}
            <a className="font-semibold text-primary hover:underline" href="/admin/activity">
              activity screen
            </a>{' '}
            and filter by this person to see what they have done.
          </p>
        </TabsContent>
      </Tabs>

      <UserActionsDialog
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        user={person}
        currentUserId={me?.id ?? ''}
        onChanged={() => void load()}
      />

      <UserPermissionsDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        user={person}
        onSaved={() => void load()}
      />
    </AdminLayout>
  );
};
