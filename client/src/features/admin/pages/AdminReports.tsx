import React, { useCallback, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { DataView } from '../DataView';
import { useAdminList } from '../useAdminList';
import { Chip } from '../AdminChip';
import { AdminGroupReports } from './panels/AdminGroupReports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { listAdminGroups, type AdminGroup } from '@/lib/adminApi';
import { formatPaiseCompact } from '@/lib/money';

/**
 * Reports.
 *
 * Exports come from the existing six-sheet workbook endpoint, so this screen is a group
 * picker rather than a second reporting engine.
 *
 * Worth knowing: that endpoint is membership-scoped by design. An administrator who is
 * not a member of the group will be refused, which is the group boundary holding rather
 * than a fault, and the panel says so when it happens.
 */
export const AdminReports: React.FC = () => {
  const [selected, setSelected] = useState<AdminGroup | null>(null);

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminGroups(params);
      return { rows: data.groups, total: data.pagination.total };
    },
    [],
  );

  const list = useAdminList<AdminGroup>(fetcher);

  if (selected) {
    return (
      <AdminLayout title={`Export — ${selected.name}`}>
        <div className="space-y-3">
          <Button variant="outline" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Choose a different group
          </Button>
          <AdminGroupReports groupId={selected.id} groupName={selected.name} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Reports"
      toolbar={
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder="Find a group to export"
            className="h-11 pl-9"
            aria-label="Search groups"
          />
        </div>
      }
    >
      <AdminPageHeader
        title="Reports"
        description="Export a group’s expenses, settlements and balances for a date range."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Reports' }]}
      />

      <DataView
        rows={list.rows}
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
          hasMore: list.offset + (list.rows?.length ?? 0) < list.total,
          onPage: list.setOffset,
        }}
        head={
          <>
            <TableHead>Group</TableHead>
            <TableHead>Expenses</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-28 text-right">Export</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell className="font-semibold">{row.name}</TableCell>
            <TableCell className="tabular-nums">{row.expenseCount}</TableCell>
            <TableCell className="font-mono tabular-nums">
              {formatPaiseCompact(row.totalValuePaise)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                className="h-11"
                onClick={() => setSelected(row)}
              >
                Export
              </Button>
            </TableCell>
          </TableRow>
        )}
        renderCard={(row) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Chip>{row.expenseCount} expenses</Chip>
                <Chip tone="info">{formatPaiseCompact(row.totalValuePaise)}</Chip>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => setSelected(row)}
            >
              Export
            </Button>
          </div>
        )}
      />
    </AdminLayout>
  );
};
