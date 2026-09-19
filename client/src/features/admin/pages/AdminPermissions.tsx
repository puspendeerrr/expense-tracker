import React, { useCallback, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { DataView, RowActions } from '../DataView';
import { useAdminList } from '../useAdminList';
import { Chip } from '../AdminChip';
import { UserPermissionsDialog } from '../UserPermissionsDialog';
import { Input } from '@/components/ui/input';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { listAdminUsers, type AdminUser } from '@/lib/adminApi';

/**
 * Permission overview.
 *
 * The same people, framed around capabilities rather than accounts: who has been given
 * something unusual, and who is on the platform defaults. Editing opens the same dialog
 * the user screens use, so there is exactly one permission editor in the product.
 */
export const AdminPermissions: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('admin.permissions.manage');
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminUsers({ ...params, role: 'all', verified: 'all' });
      return { rows: data.users, total: data.pagination.total };
    },
    [],
  );

  const list = useAdminList<AdminUser>(fetcher);

  const actionsFor = (row: AdminUser) =>
    canManage
      ? [{ label: 'Edit permissions', icon: Shield, onSelect: () => setEditing(row) }]
      : [];

  const overrideCell = (row: AdminUser) => {
    if (row.role === 'admin') {
      return <span className="text-xs text-muted-foreground">Holds everything</span>;
    }
    if (row.permissionOverrideCount > 0) {
      return <Chip tone="warn">{row.permissionOverrideCount} custom</Chip>;
    }
    return <span className="text-xs text-muted-foreground">Platform defaults</span>;
  };

  return (
    <AdminLayout
      title="Permissions"
      toolbar={
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder="Name or email"
            className="h-11 pl-9"
            aria-label="Search people"
          />
        </div>
      }
    >
      <AdminPageHeader
        title="Permissions"
        description="Grant or deny individual capabilities per account. Allow and deny both override the role default."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Permissions' }]}
      />

      <DataView
        rows={list.rows}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No people match that search"
        keyFor={(row) => row.id}
        pagination={{
          total: list.total,
          limit: list.limit,
          offset: list.offset,
          hasMore: list.offset + (list.rows?.length ?? 0) < list.total,
          onPage: list.setOffset,
        }}
        head={
          <>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Capabilities</TableHead>
            <TableHead className="w-14 text-right">Actions</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell>
              <p className="font-semibold">{row.fullName}</p>
              <p className="text-xs text-muted-foreground">{row.email}</p>
            </TableCell>
            <TableCell>
              <Chip tone={row.role === 'admin' ? 'info' : 'neutral'}>{row.role}</Chip>
            </TableCell>
            <TableCell>{overrideCell(row)}</TableCell>
            <TableCell className="text-right">
              <RowActions label={row.fullName} actions={actionsFor(row)} />
            </TableCell>
          </TableRow>
        )}
        renderCard={(row) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <Chip tone={row.role === 'admin' ? 'info' : 'neutral'}>{row.role}</Chip>
                {row.role !== 'admin' && row.permissionOverrideCount > 0 && (
                  <Chip tone="warn">{row.permissionOverrideCount} custom</Chip>
                )}
              </div>
            </div>
            <RowActions label={row.fullName} actions={actionsFor(row)} />
          </div>
        )}
      />

      <UserPermissionsDialog
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
        user={editing}
        onSaved={list.reload}
      />
    </AdminLayout>
  );
};
