import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, Power, PowerOff, Trash2 } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { AdminFilterBar, type ActiveFilterChip } from '../AdminFilterBar';
import { useUrlFilters } from '../useUrlFilters';
import { DataView, RowActions } from '../DataView';
import { useAdminList, sortRows } from '../useAdminList';
import { Chip } from '../AdminChip';
import { ConfirmDialog } from '../ConfirmDialog';
import { TableCell, TableHead, TableRow, SortableHead } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  deleteGroup,
  disableGroup,
  enableGroup,
  listAdminGroups,
  type AdminGroup,
} from '@/lib/adminApi';
import { formatPaiseCompact } from '@/lib/money';

const FILTER_KEYS = ['status'] as const;
const FILTER_DEFAULTS = { status: 'all' };
const FILTER_LABELS: Record<string, Record<string, string>> = {
  status: { active: 'Active groups', disabled: 'Disabled groups' },
};

export const AdminGroups: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManage = can('admin.groups.manage');

  const [confirm, setConfirm] = useState<
    { kind: 'disable' | 'enable' | 'delete'; group: AdminGroup } | null
  >(null);
  const [isBusy, setIsBusy] = useState(false);

  const { values, setFilter, reset, active, hasFilters } = useUrlFilters(
    FILTER_KEYS,
    FILTER_DEFAULTS,
  );
  const status = values.status as 'all' | 'active' | 'disabled';

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminGroups({ ...params, status });
      return { rows: data.groups, total: data.pagination.total };
    },
    [status],
  );

  const list = useAdminList<AdminGroup>(fetcher, { deps: [status] });

  const chips: ActiveFilterChip[] = useMemo(
    () =>
      active.map((key) => ({
        key,
        label: FILTER_LABELS[key]?.[values[key]] ?? `${key}: ${values[key]}`,
        onClear: () => setFilter(key, FILTER_DEFAULTS[key]),
      })),
    [active, values, setFilter],
  );

  const visible = list.rows
    ? sortRows(list.rows, list.sortColumn, list.sortDirection, (row, column) => {
        if (column === 'name') return row.name;
        if (column === 'members') return row.memberCount;
        if (column === 'expenses') return row.expenseCount;
        if (column === 'value') return row.totalValuePaise;
        return null;
      })
    : null;

  const runConfirmed = async () => {
    if (!confirm || isBusy) return;
    setIsBusy(true);
    try {
      if (confirm.kind === 'disable') {
        await disableGroup(confirm.group.id);
        toast.success(`${confirm.group.name} is now read-only.`);
      } else if (confirm.kind === 'enable') {
        await enableGroup(confirm.group.id);
        toast.success(`${confirm.group.name} re-enabled.`);
      } else {
        await deleteGroup(confirm.group.id);
        toast.success(`${confirm.group.name} deleted.`);
      }
      setConfirm(null);
      list.reload();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'That action could not be completed.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const rowActions = (row: AdminGroup) => [
    { label: 'Open group', icon: Eye, onSelect: () => navigate(`/admin/groups/${row.id}`) },
    ...(canManage
      ? [
          row.status === 'disabled'
            ? { label: 'Enable group', icon: Power, onSelect: () => setConfirm({ kind: 'enable', group: row }) }
            : {
                label: 'Disable group',
                icon: PowerOff,
                onSelect: () => setConfirm({ kind: 'disable', group: row }),
              },
          {
            label: 'Delete group',
            icon: Trash2,
            destructive: true,
            onSelect: () => setConfirm({ kind: 'delete', group: row }),
          },
        ]
      : []),
  ];

  return (
    <AdminLayout
      title="Groups"
      toolbar={
        <AdminFilterBar
          search={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder="Group name or invite code"
          searchLabel="groups"
          chips={chips}
          onReset={hasFilters ? reset : undefined}
        >
          <Select value={status} onValueChange={(value) => setFilter('status', value)}>
            <SelectTrigger
              className="h-11 w-auto min-w-[130px]"
              aria-label="Filter by group status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </AdminFilterBar>
      }
    >
      <AdminPageHeader
        title="Groups"
        description="Every group, who owns it, what it holds and whether it is accepting activity."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Groups' }]}
        count={`${list.total} group${list.total === 1 ? '' : 's'}`}
        onRefresh={list.reload}
        isRefreshing={list.isRefreshing}
      />

      <DataView
        rows={visible}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No groups match that search"
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
            <SortableHead label="Group" column="name" activeColumn={list.sortColumn} direction={list.sortDirection} onSort={list.toggleSort} />
            <TableHead>Creator</TableHead>
            <TableHead>Status</TableHead>
            <SortableHead label="Members" column="members" activeColumn={list.sortColumn} direction={list.sortDirection} onSort={list.toggleSort} />
            <SortableHead label="Expenses" column="expenses" activeColumn={list.sortColumn} direction={list.sortDirection} onSort={list.toggleSort} />
            <SortableHead label="Value" column="value" activeColumn={list.sortColumn} direction={list.sortDirection} onSort={list.toggleSort} />
            <TableHead className="w-14 text-right">Actions</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell>
              <p className="font-semibold">{row.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{row.inviteCode}</p>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.creatorName}</TableCell>
            <TableCell>
              <Chip tone={row.status === 'active' ? 'ok' : 'bad'}>{row.status}</Chip>
            </TableCell>
            <TableCell className="tabular-nums">{row.memberCount}</TableCell>
            <TableCell className="tabular-nums">{row.expenseCount}</TableCell>
            <TableCell className="font-mono tabular-nums">
              {formatPaiseCompact(row.totalValuePaise)}
            </TableCell>
            <TableCell className="text-right">
              <RowActions label={row.name} actions={rowActions(row)} />
            </TableCell>
          </TableRow>
        )}
        renderCard={(row) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.creatorName} · <span className="font-mono">{row.inviteCode}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Chip tone={row.status === 'active' ? 'ok' : 'bad'}>{row.status}</Chip>
                <Chip>{row.memberCount} members</Chip>
                <Chip>{row.expenseCount} expenses</Chip>
                <Chip>{formatPaiseCompact(row.totalValuePaise)}</Chip>
              </div>
            </div>
            <RowActions label={row.name} actions={rowActions(row)} />
          </div>
        )}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        isBusy={isBusy}
        onConfirm={() => void runConfirmed()}
        destructive={confirm?.kind !== 'enable'}
        confirmLabel={
          confirm?.kind === 'delete'
            ? 'Delete permanently'
            : confirm?.kind === 'enable'
              ? 'Enable'
              : 'Disable'
        }
        title={
          confirm?.kind === 'delete'
            ? `Delete ${confirm.group.name}?`
            : confirm?.kind === 'enable'
              ? `Enable ${confirm?.group.name}?`
              : `Disable ${confirm?.group.name}?`
        }
        // Retyping the name is reserved for the one action here that cannot be undone.
        {...(confirm?.kind === 'delete' ? { confirmText: confirm.group.name } : {})}
        description={
          confirm?.kind === 'delete'
            ? `Permanently deletes ${confirm.group.expenseCount} expense${
                confirm.group.expenseCount === 1 ? '' : 's'
              } worth ${formatPaiseCompact(confirm.group.totalValuePaise)}, every settlement and ` +
              `every balance, for all ${confirm.group.memberCount} member${
                confirm.group.memberCount === 1 ? '' : 's'
              }. Outstanding debts between them are erased rather than settled. This cannot be undone.`
            : confirm?.kind === 'enable'
              ? `The ${confirm.group.memberCount} member${
                  confirm.group.memberCount === 1 ? '' : 's'
                } of this group will be able to add expenses and record payments again. Balances are unchanged. Reversible at any time.`
              : `The ${confirm?.group.memberCount} member${
                  confirm?.group.memberCount === 1 ? '' : 's'
                } of this group keep read and export access, but no new expenses or payments can be added. Existing balances are untouched. Reversible at any time.`
        }
      />
    </AdminLayout>
  );
};
