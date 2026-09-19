import React, { useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { DataView } from '../DataView';
import { useAdminList } from '../useAdminList';
import { Chip } from '../AdminChip';
import { describeActivity } from './panels/AdminGroupActivity';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { listAdminActivity, type AdminActivity as Row } from '@/lib/adminApi';

/**
 * Platform activity timeline.
 *
 * Reads the same rows the group feeds use and renders them with the same wording rules,
 * so a migrated entry reads here exactly as it does for its group. Nothing sensitive is
 * shown: activity metadata records domain facts only.
 */
export const AdminActivity: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminActivity({
        ...params,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(type ? { type } : {}),
      });
      return { rows: data.activities, total: data.pagination.total };
    },
    [from, to, type],
  );

  const list = useAdminList<Row>(fetcher, { deps: [from, to, type] });

  return (
    <AdminLayout
      title="Activity"
      toolbar={
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={list.search}
              onChange={(event) => list.setSearch(event.target.value)}
              placeholder="Person, group or detail"
              className="h-11 pl-9"
              aria-label="Search activity"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity-from" className="text-[11px]">From</Label>
            <Input
              id="activity-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-11 w-auto"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity-to" className="text-[11px]">To</Label>
            <Input
              id="activity-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-11 w-auto"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity-type" className="text-[11px]">Type</Label>
            <Input
              id="activity-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="expense_created"
              className="h-11 w-auto min-w-[150px]"
            />
          </div>
        </div>
      }
    >
      <AdminPageHeader
        title="Activity"
        description="What members did, in which group and when. Group-scoped, and never shows secrets."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Activity' }]}
      />

      <DataView
        rows={list.rows}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No activity matches those filters"
        emptyHint="Try widening the date range or clearing the type."
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
            <TableHead>Who</TableHead>
            <TableHead>What</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>When</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell>
              <p className="font-semibold">{row.actor.fullName}</p>
              <p className="text-xs text-muted-foreground">{row.actor.email}</p>
            </TableCell>
            <TableCell className="text-muted-foreground">{describeActivity(row)}</TableCell>
            <TableCell>{row.group.name}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {new Date(row.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </TableCell>
          </TableRow>
        )}
        renderCard={(row) => (
          <div>
            <p className="text-sm">
              <span className="font-semibold">{row.actor.fullName}</span>{' '}
              <span className="text-muted-foreground">{describeActivity(row)}</span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <Chip>{row.group.name}</Chip>
              <Chip tone="info">{row.type.replace(/_/g, ' ')}</Chip>
              <span className="text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
          </div>
        )}
      />
    </AdminLayout>
  );
};
