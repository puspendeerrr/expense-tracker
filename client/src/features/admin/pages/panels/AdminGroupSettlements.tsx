import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Search } from 'lucide-react';
import { DataView, RowActions } from '../../DataView';
import { useAdminList } from '../../useAdminList';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Chip, prettyStatus, settlementTone } from '../../AdminChip';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
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
  cancelAdminSettlement,
  listAdminSettlements,
  type AdminSettlement,
} from '@/lib/adminApi';
import { formatPaise } from '@/lib/money';

/**
 * Settlements within one group.
 *
 * Each row shows the live debt between the two parties alongside the recorded amount.
 * That figure comes from the balance engine on the server, not from subtracting numbers
 * on this screen -- which is what keeps "₹500 recorded, ₹1,200 still outstanding"
 * trustworthy.
 */
export const AdminGroupSettlements: React.FC<{
  groupId?: string;
  onChanged?: () => void;
}> = ({ groupId, onChanged }) => {
  const { can } = useAuth();
  const [status, setStatus] = useState<string>('all');
  const canManage = can('admin.groups.manage');
  const [confirm, setConfirm] = useState<AdminSettlement | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminSettlements({
        ...params,
        status,
        ...(groupId ? { groupId } : {}),
      });
      return { rows: data.settlements, total: data.pagination.total };
    },
    [groupId, status],
  );

  const list = useAdminList<AdminSettlement>(fetcher, { deps: [groupId ?? 'all', status] });

  const cancel = async () => {
    if (!confirm || isBusy) return;
    setIsBusy(true);
    try {
      await cancelAdminSettlement(confirm.id);
      toast.success('Settlement cancelled.');
      setConfirm(null);
      list.reload();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'That settlement could not be cancelled.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const actions = (row: AdminSettlement) =>
    canManage
      ? [
          {
            label: 'Cancel settlement',
            icon: Ban,
            destructive: true,
            disabled: row.status === 'cancelled' || row.status === 'rejected',
            disabledReason: 'Already closed',
            onSelect: () => setConfirm(row),
          },
        ]
      : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder="Group name or note"
            className="h-11 pl-9"
            aria-label="Search settlements"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-auto min-w-[170px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="paid_pending_approval">Awaiting confirmation</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="will_pay_soon">Will pay soon</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataView
        rows={list.rows}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No settlements recorded"
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
            <TableHead>Payment</TableHead>
            {!groupId && <TableHead>Group</TableHead>}
            <TableHead>Amount</TableHead>
            <TableHead>Still owed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-14 text-right">Actions</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell>
              <p className="font-semibold">
                {row.payer.fullName} &rarr; {row.receiver?.fullName ?? 'Former member'}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.paymentMethod}
                {row.hasProof && ' · proof attached'}
              </p>
            </TableCell>
            {!groupId && (
              <TableCell className="text-muted-foreground">{row.group.name}</TableCell>
            )}
            <TableCell className="font-mono font-semibold tabular-nums">
              {formatPaise(row.amountPaise)}
            </TableCell>
            <TableCell className="font-mono tabular-nums text-muted-foreground">
              {formatPaise(row.outstandingPaise)}
            </TableCell>
            <TableCell>
              <Chip tone={settlementTone(row.status)}>{prettyStatus(row.status)}</Chip>
            </TableCell>
            <TableCell className="text-right">
              <RowActions
                label={`${row.payer.fullName} payment`}
                actions={actions(row)}
              />
            </TableCell>
          </TableRow>
        )}
        renderCard={(row) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {row.payer.fullName} &rarr; {row.receiver?.fullName ?? 'Former member'}
              </p>
              {!groupId && (
                <p className="truncate text-xs text-muted-foreground">{row.group.name}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Chip tone={settlementTone(row.status)}>{prettyStatus(row.status)}</Chip>
                <Chip tone="info">{formatPaise(row.amountPaise)}</Chip>
                <Chip>owed {formatPaise(row.outstandingPaise)}</Chip>
              </div>
            </div>
            <RowActions label={`${row.payer.fullName} payment`} actions={actions(row)} />
          </div>
        )}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        isBusy={isBusy}
        onConfirm={() => void cancel()}
        confirmLabel="Cancel settlement"
        title="Cancel this settlement?"
        description="A cancelled settlement stops counting toward anyone's balance, so the debt it covered becomes outstanding again. The record itself is kept."
      />
    </div>
  );
};
