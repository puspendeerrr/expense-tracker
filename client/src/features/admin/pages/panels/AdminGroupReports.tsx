import React, { useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadExport } from '@/lib/domainApi';
import { toLocalIsoDate } from '@/lib/dateRange';

/**
 * Group report export.
 *
 * Reuses the existing export endpoint and its six-sheet workbook rather than building a
 * second report. The endpoint is membership-scoped by design, so an administrator who is
 * not a member of the group will receive a 404 here -- that is the group scoping working,
 * not a bug, and the message says so.
 */
export const AdminGroupReports: React.FC<{ groupId: string; groupName: string }> = ({
  groupId,
  groupName,
}) => {
  const [from, setFrom] = useState(toLocalIsoDate(new Date(Date.now() - 365 * 86_400_000)));
  const [to, setTo] = useState(toLocalIsoDate(new Date()));
  const [isBusy, setIsBusy] = useState(false);

  const run = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const params = new URLSearchParams({ from, to });
      const { blob, filename } = await downloadExport(groupId, params);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Report downloaded.');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : 'Could not generate that report. Exports are scoped to group members.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="rounded-admin border border-admin-border bg-admin-chrome p-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-bold">Export {groupName}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Summary, expenses, splits, person-wise relationships, settlements and period
        breakdown &mdash; the same workbook members can download.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      <Button className="mt-4 w-full sm:w-auto" disabled={isBusy} onClick={() => void run()}>
        {isBusy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {isBusy ? 'Preparing…' : 'Download workbook'}
      </Button>
    </div>
  );
};
