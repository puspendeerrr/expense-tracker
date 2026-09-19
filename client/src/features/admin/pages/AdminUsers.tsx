import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, KeyRound, Shield, UserCheck, UserX } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { AdminFilterBar, type ActiveFilterChip } from '../AdminFilterBar';
import { DataView, RowActions } from '../DataView';
import { useAdminList, sortRows } from '../useAdminList';
import { useUrlFilters } from '../useUrlFilters';
import { UserActionsDialog } from '../UserActionsDialog';
import { UserPermissionsDialog } from '../UserPermissionsDialog';
import { TableCell, TableRow, SortableHead, TableHead } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Chip } from '../AdminChip';
import { useAuth } from '@/context/AuthContext';
import { listAdminUsers, type AdminUser } from '@/lib/adminApi';

/**
 * Account administration.
 *
 * Every row action goes through the same dialogs the detail screen uses, so a change
 * made from the list and a change made from the detail page take exactly the same path
 * through the API and produce the same audit record.
 */

const FILTER_KEYS = ['role', 'verified', 'status'] as const;
const FILTER_DEFAULTS = { role: 'all', verified: 'all', status: 'all' };

const FILTER_LABELS: Record<string, Record<string, string>> = {
  role: { admin: 'Admins only', user: 'Non-admins only' },
  verified: { true: 'Verified', false: 'Unverified' },
  status: { active: 'Active accounts', disabled: 'Disabled accounts' },
};

export const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const { user, can } = useAuth();

  const { values, setFilter, reset, active, hasFilters } = useUrlFilters(
    FILTER_KEYS,
    FILTER_DEFAULTS,
  );
  const role = values.role as 'all' | 'admin' | 'user';
  const verified = values.verified as 'all' | 'true' | 'false';
  const status = values.status as 'all' | 'active' | 'disabled';

  const [actionsFor, setActionsFor] = useState<AdminUser | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<AdminUser | null>(null);

  const canManageUsers = can('admin.users.manage');
  const canManagePermissions = can('admin.permissions.manage');

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminUsers({ ...params, role, verified, status });
      return { rows: data.users, total: data.pagination.total };
    },
    [role, verified, status],
  );

  const list = useAdminList<AdminUser>(fetcher, { deps: [role, verified, status] });

  const visible = list.rows
    ? sortRows(list.rows, list.sortColumn, list.sortDirection, (row, column) => {
        if (column === 'name') return row.fullName;
        if (column === 'email') return row.email;
        if (column === 'groups') return row.groupCount;
        if (column === 'sessions') return row.activeSessions;
        if (column === 'created') return row.createdAt;
        return null;
      })
    : null;

  const chips: ActiveFilterChip[] = useMemo(
    () =>
      active.map((key) => ({
        key,
        label: FILTER_LABELS[key]?.[values[key]] ?? `${key}: ${values[key]}`,
        onClear: () => setFilter(key, FILTER_DEFAULTS[key]),
      })),
    [active, values, setFilter],
  );

  const rowActions = (row: AdminUser) => [
    { label: 'View details', icon: Eye, onSelect: () => navigate(`/admin/users/${row.id}`) },
    ...(canManagePermissions
      ? [{ label: 'Permissions', icon: Shield, onSelect: () => setPermissionsFor(row) }]
      : []),
    ...(canManageUsers
      ? [
          { label: 'Manage account', icon: KeyRound, onSelect: () => setActionsFor(row) },
          {
            label: row.status === 'disabled' ? 'Enable account' : 'Disable account',
            icon: row.status === 'disabled' ? UserCheck : UserX,
            destructive: row.status !== 'disabled',
            disabled: row.id === user?.id,
            disabledReason: 'You cannot disable your own account',
            onSelect: () => setActionsFor(row),
          },
        ]
      : []),
  ];

  const statusChips = (row: AdminUser) => (
    <>
      <Chip tone={row.status === 'active' ? 'ok' : 'bad'}>{row.status}</Chip>
      {row.role === 'admin' && <Chip tone="info">admin</Chip>}
      {!row.isVerified && <Chip tone="warn">unverified</Chip>}
      {row.permissionOverrideCount > 0 && (
        <Chip tone="neutral">{row.permissionOverrideCount} custom</Chip>
      )}
    </>
  );

  return (
    <AdminLayout
      title="Users"
      toolbar={
        <AdminFilterBar
          search={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder="Name or email"
          searchLabel="users"
          chips={chips}
          onReset={hasFilters ? reset : undefined}
        >
          <Select value={role} onValueChange={(value) => setFilter('role', value)}>
            <SelectTrigger className="h-11 w-auto min-w-[120px]" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="user">Users</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(value) => setFilter('status', value)}>
            <SelectTrigger
              className="h-11 w-auto min-w-[130px]"
              aria-label="Filter by account status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any account</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={verified} onValueChange={(value) => setFilter('verified', value)}>
            <SelectTrigger
              className="h-11 w-auto min-w-[130px]"
              aria-label="Filter by verification"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any verification</SelectItem>
              <SelectItem value="true">Verified</SelectItem>
              <SelectItem value="false">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </AdminFilterBar>
      }
    >
      <AdminPageHeader
        title="Users"
        description="Every account on the platform: roles, access, sessions and status."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Users' }]}
        count={`${list.total} account${list.total === 1 ? '' : 's'}`}
        onRefresh={list.reload}
        isRefreshing={list.isRefreshing}
      />

      <DataView
        rows={visible}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No users match those filters"
        emptyHint="Try clearing the search or changing the role filter."
        keyFor={(row) => row.id}
        pagination={{
          total: list.total,
          limit: list.limit,
          offset: list.offset,
          hasMore: list.offset + (visible?.length ?? 0) < list.total,
          onPage: list.setOffset,
        }}
        head={
          <>
            <SortableHead
              label="Name"
              column="name"
              activeColumn={list.sortColumn}
              direction={list.sortDirection}
              onSort={list.toggleSort}
            />
            <SortableHead
              label="Email"
              column="email"
              activeColumn={list.sortColumn}
              direction={list.sortDirection}
              onSort={list.toggleSort}
            />
            <TableHead>Status</TableHead>
            <SortableHead
              label="Groups"
              column="groups"
              activeColumn={list.sortColumn}
              direction={list.sortDirection}
              onSort={list.toggleSort}
            />
            <SortableHead
              label="Sessions"
              column="sessions"
              activeColumn={list.sortColumn}
              direction={list.sortDirection}
              onSort={list.toggleSort}
            />
            <SortableHead
              label="Joined"
              column="created"
              activeColumn={list.sortColumn}
              direction={list.sortDirection}
              onSort={list.toggleSort}
            />
            <TableHead className="w-14 text-right">Actions</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell className="font-semibold">{row.fullName}</TableCell>
            <TableCell className="text-muted-foreground">{row.email}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">{statusChips(row)}</div>
            </TableCell>
            <TableCell className="tabular-nums">{row.groupCount}</TableCell>
            <TableCell className="tabular-nums">{row.activeSessions}</TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: '2-digit',
              })}
            </TableCell>
            <TableCell className="text-right">
              <RowActions label={row.fullName} actions={rowActions(row)} />
            </TableCell>
          </TableRow>
        )}
        renderCard={(row) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {statusChips(row)}
                <Chip tone="neutral">{row.groupCount} groups</Chip>
                {row.activeSessions > 0 && (
                  <Chip tone="neutral">{row.activeSessions} sessions</Chip>
                )}
              </div>
            </div>
            <RowActions label={row.fullName} actions={rowActions(row)} />
          </div>
        )}
      />

      <UserActionsDialog
        open={actionsFor !== null}
        onOpenChange={(next) => !next && setActionsFor(null)}
        user={actionsFor}
        currentUserId={user?.id ?? ''}
        onChanged={list.reload}
      />

      <UserPermissionsDialog
        open={permissionsFor !== null}
        onOpenChange={(next) => !next && setPermissionsFor(null)}
        user={permissionsFor}
        onSaved={list.reload}
      />
    </AdminLayout>
  );
};
