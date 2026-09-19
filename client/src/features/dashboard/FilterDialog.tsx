import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DEFAULT_FILTERS, toLocalIsoDate } from '@/lib/dateRange';
import type { DatePreset, PersonRef, ReportFilters } from '@/types/domain';

/**
 * Dashboard filters, in a CENTRED dialog (not a side drawer).
 *
 * The dialog edits a DRAFT copy of the filters. Nothing is applied until "Apply
 * filters" is pressed, so the dashboard behind never refetches while someone is still
 * choosing. "Cancel" discards the draft; "Reset" returns it to defaults without
 * applying, so a reset can itself be cancelled.
 */

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ReportFilters;
  members: PersonRef[];
  onApply: (filters: ReportFilters) => void;
}

export const FilterDialog: React.FC<FilterDialogProps> = ({
  open,
  onOpenChange,
  filters,
  members,
  onApply,
}) => {
  const [draft, setDraft] = useState<ReportFilters>(filters);
  const [dateError, setDateError] = useState<string | null>(null);

  // Re-seed the draft each time the dialog opens, so a cancelled edit never leaks
  // into the next session.
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setDateError(null);
    }
  }, [open, filters]);

  const patch = (changes: Partial<ReportFilters>) => {
    setDraft((prev) => ({ ...prev, ...changes }));
    setDateError(null);
  };

  const handleApply = () => {
    if (draft.preset === 'custom') {
      if (!draft.from || !draft.to) {
        setDateError('Choose both a start and an end date.');
        return;
      }
      if (draft.from > draft.to) {
        setDateError('The start date must not be after the end date.');
        return;
      }
    }
    onApply(draft);
    onOpenChange(false);
  };

  const today = toLocalIsoDate(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Rises from the bottom on a phone (thumb-reachable, matches the platform
          idiom) and becomes a centred card from sm up. */}
      <DialogContent variant="sheet" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>
            Filters change the analytics and charts. Your current balances are never
            filtered by date.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* ---- Date range ---- */}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Date range</legend>
            <div className="grid grid-cols-2 gap-2">
              {DATE_PRESETS.map((preset) => {
                const isActive = draft.preset === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => patch({ preset: preset.value })}
                    aria-pressed={isActive}
                    className={cn(
                      // 44px min height keeps every option thumb-friendly.
                      'min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {draft.preset === 'custom' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-from">From</Label>
                  <Input
                    id="filter-from"
                    type="date"
                    max={today}
                    value={draft.from ?? ''}
                    onChange={(event) => patch({ from: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-to">To</Label>
                  <Input
                    id="filter-to"
                    type="date"
                    max={today}
                    value={draft.to ?? ''}
                    onChange={(event) => patch({ to: event.target.value })}
                  />
                </div>
              </div>
            )}

            {dateError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {dateError}
              </p>
            )}
          </fieldset>

          {/* ---- Member ---- */}
          <div className="space-y-1.5">
            <Label htmlFor="filter-member">Member</Label>
            <Select
              value={draft.memberId}
              onValueChange={(value) => patch({ memberId: value })}
            >
              <SelectTrigger id="filter-member">
                <SelectValue placeholder="All members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ---- Payment mode ---- */}
          <div className="space-y-1.5">
            <Label htmlFor="filter-payment">Payment mode</Label>
            <Select
              value={draft.paymentMode}
              onValueChange={(value) =>
                patch({ paymentMode: value as ReportFilters['paymentMode'] })
              }
            >
              <SelectTrigger id="filter-payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI / Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ---- Involvement ---- */}
          <div className="space-y-1.5">
            <Label htmlFor="filter-involvement">Involvement</Label>
            <Select
              value={draft.involvement}
              onValueChange={(value) =>
                patch({ involvement: value as ReportFilters['involvement'] })
              }
            >
              <SelectTrigger id="filter-involvement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All group expenses</SelectItem>
                <SelectItem value="involving_me">Involving me</SelectItem>
                <SelectItem value="paid_by_me">Paid by me</SelectItem>
                <SelectItem value="paid_by_others_for_me">Paid by others for me</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogBody>

        {/* One row even on a phone: three stacked full-width buttons pushed the
            primary action off the fold. */}
        <DialogFooter className="!flex-row items-center gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            // Resets the draft only: still cancellable until Apply is pressed.
            onClick={() => {
              setDraft(DEFAULT_FILTERS);
              setDateError(null);
            }}
            className="shrink-0 px-3 sm:mr-auto"
          >
            <RotateCcw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Reset</span>
            <span className="sr-only sm:hidden">Reset filters</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="shrink-0"
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} className="flex-1 sm:flex-none">
            Apply
            <span className="hidden sm:ml-1 sm:inline">filters</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
