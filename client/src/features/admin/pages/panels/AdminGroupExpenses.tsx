import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { DataView, RowActions } from '../../DataView';
import { useAdminList } from '../../useAdminList';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Chip } from '../../AdminChip';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { deleteAdminExpense, listAdminExpenses } from '@/lib/adminApi';
import { formatPaise } from '@/lib/money';

/**
 * Expenses within one group.
 *
 * Deleting routes through the ordinary expense service, so participant rows cascade and
 * the balance engine simply stops seeing the expense. No balance is recalculated here.
 */

type Row = {
  id: string;
  title: string;
  amountPaise: number;
  category: string | null;
  paymentMode: string;
  expenseDate: string;
  payerName: string;
  participantCount: number;
};

export const AdminGroupExpenses: React.FC<{
  /** Omitted on the platform-wide screen, which shows every group's expenses. */
  groupId?: string;
  onChanged?: () => void;
}> = ({ groupId, onChanged }) => {
  const { can } = useAuth();
  const canManage = can('admin.groups.manage');
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminExpenses({ ...params, ...(groupId ? { groupId } : {}) });
      return {
        rows: data.expenses as unknown as Row[],
        total: data.pagination.total,
      };
    },
    [groupId],
  );

  const list = useAdminList<Row>(fetcher, { deps: [groupId ?? 'all'] });

  const remove = async () => {
    if (!confirm || isBusy) return;
    setIsBusy(true);
    try {
      await deleteAdminExpense(confirm.id);
      toast.success(`"${confirm.title}" deleted.`);
      setConfirm(null);
      list.reload();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'That expense could not be deleted.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const actions = (row: Row) =>
    canManage
      ? [
          {
            label: 'Delete expense',
            icon: Trash2,
            destructive: true,
            onSelect: () => setConfirm(row),
          },
        ]
      : [];

  return (
    <>
      <DataView
        rows={list.rows}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No expenses in this group"
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
            <TableHead>Title</TableHead>
            <TableHead>Paid by</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Split</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-14 text-right">Actions</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell>
              <p className="font-semibold">{row.title}</p>
              {row.category && (
                <p className="text-xs text-muted-foreground">{row.category.replace(/_/g, ' ')}</p>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">{row.payerName}</TableCell>
            <TableCell className="font-mono font-semibold tabular-nums">
              {formatPaise(row.amountPaise)}
            </TableCell>
            <TableCell className="tabular-nums">{row.participantCount} ways</TableCell>
            <TableCell className="text-muted-foreground">{row.expenseDate}</TableCell>
            <TableCell className="text-right">
              <RowActions label={row.title} actions={actions(row)} />
            </TableCell>
          </TableRow>
        )}
        renderCard={(row) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.payerName} · {row.expenseDate}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Chip tone="info">{formatPaise(row.amountPaise)}</Chip>
                <Chip>{row.participantCount} ways</Chip>
                <Chip>{row.paymentMode}</Chip>
              </div>
            </div>
            <RowActions label={row.title} actions={actions(row)} />
          </div>
        )}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        isBusy={isBusy}
        onConfirm={() => void remove()}
        confirmLabel="Delete expense"
        title={`Delete "${confirm?.title}"?`}
        description="The expense and its splits are removed permanently. Balances are derived, so everyone's position updates immediately. This cannot be undone."
      />
    </>
  );
};
