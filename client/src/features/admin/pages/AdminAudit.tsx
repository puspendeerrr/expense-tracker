import React, { useCallback, useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { DataView } from '../DataView';
import { useAdminList } from '../useAdminList';
import { Chip } from '../AdminChip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import { listAdminAudit, listAuditActions, type AdminAudit as Row } from '@/lib/adminApi';

/**
 * Administrative audit trail.
 *
 * Append-only: there is no endpoint anywhere that edits or removes a row, and this screen
 * offers no such control. Metadata is stripped of anything credential-shaped before it is
 * ever written, so nothing here can leak a password, OTP or token.
 */
const summarise = (row: Row): string => {
  const entries = Object.entries(row.metadata ?? {});
  if (entries.length === 0) return '—';
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? '…' : String(value)}`)
    .join(' · ');
};

export const AdminAudit: React.FC = () => {
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actions, setActions] = useState<string[]>([]);

  useEffect(() => {
    void listAuditActions()
      .then((data) => setActions(data.actions))
      .catch(() => setActions([]));
  }, []);

  const fetcher = useCallback(
    async (params: { limit: number; offset: number; search?: string }) => {
      const data = await listAdminAudit({
        ...params,
        ...(action !== 'all' ? { action } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      return { rows: data.audits, total: data.pagination.total };
    },
    [action, from, to],
  );

  const list = useAdminList<Row>(fetcher, { deps: [action, from, to] });

  return (
    <AdminLayout
      title="Audit log"
      toolbar={
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={list.search}
              onChange={(event) => list.setSearch(event.target.value)}
              placeholder="Actor, target or action"
              className="h-11 pl-9"
              aria-label="Search the audit log"
            />
          </div>

          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-11 w-auto min-w-[170px]" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any action</SelectItem>
              {actions.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace(/[._]/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-1">
            <Label htmlFor="audit-from" className="text-[11px]">From</Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 w-auto" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-to" className="text-[11px]">To</Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 w-auto" />
          </div>
        </div>
      }
    >
      <AdminPageHeader
        title="Audit log"
        description="Append-only record of every administrative action taken on this platform."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Audit log' }]}
      />

      <div className="mb-3 flex items-start gap-2 rounded-xl border border-admin-border bg-admin-chrome p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Append-only. Nothing in the product can edit or delete these records, and
          credential-shaped values are redacted before they are written.
        </p>
      </div>

      <DataView
        rows={list.rows}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No administrative actions recorded"
        emptyHint="Actions appear here as soon as an administrator changes something."
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
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>When</TableHead>
          </>
        }
        renderRow={(row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Chip tone="info">{row.action.replace(/[._]/g, ' ')}</Chip>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.actorEmail}</TableCell>
            <TableCell>{row.targetLabel ?? row.targetType ?? '—'}</TableCell>
            <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
              {summarise(row)}
            </TableCell>
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
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone="info">{row.action.replace(/[._]/g, ' ')}</Chip>
              <span className="text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
            <p className="mt-1.5 truncate text-sm">
              <span className="font-semibold">{row.actorEmail}</span>
              {row.targetLabel && (
                <span className="text-muted-foreground"> → {row.targetLabel}</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{summarise(row)}</p>
          </div>
        )}
      />
    </AdminLayout>
  );
};
