import React, { useCallback } from 'react';
import { DataView } from '../../DataView';
import { useAdminList } from '../../useAdminList';
import { Chip } from '../../AdminChip';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { listAdminActivity, type AdminActivity } from '@/lib/adminApi';

/**
 * Activity within one group.
 *
 * Wording is preserved exactly as stored: migrated rows carry their original sentence in
 * `metadata.legacyAction` and are shown verbatim rather than re-described with the newer,
 * coarser vocabulary.
 */
export const describeActivity = (row: AdminActivity): string => {
  const legacy = row.metadata?.legacyAction;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();

  const title = row.metadata?.title;
  if (typeof title === 'string' && title.trim()) {
    return `${row.type.replace(/_/g, ' ')} — "${title.trim()}"`;
  }
  return row.type.replace(/_/g, ' ');
};

export const AdminGroupActivity: React.FC<{ groupId: string }> = ({ groupId }) => {
  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminActivity({ ...params, groupId });
      return { rows: data.activities, total: data.pagination.total };
    },
    [groupId],
  );

  const list = useAdminList<AdminActivity>(fetcher, { deps: [groupId] });

  return (
    <DataView
      rows={list.rows}
      isLoading={list.isLoading}
      isRefreshing={list.isRefreshing}
      error={list.error}
      onRetry={list.reload}
      emptyTitle="No activity recorded for this group"
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
          <TableHead>When</TableHead>
        </>
      }
      renderRow={(row) => (
        <TableRow key={row.id}>
          <TableCell className="font-semibold">{row.actor.fullName}</TableCell>
          <TableCell className="text-muted-foreground">{describeActivity(row)}</TableCell>
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
            <Chip>{row.type.replace(/_/g, ' ')}</Chip>
            <span className="text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      )}
    />
  );
};
