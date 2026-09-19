import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Users2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/lib/names';
import { resolveDatePreset, toLocalIsoDate } from '@/lib/dateRange';
import type { DatePreset, ExpenseCategory, PersonRef, ReportFilters } from '@/types/domain';

/**
 * Export builder.
 *
 * The Export button used to download the dashboard's current filters immediately, which
 * meant the one thing people actually want from an export -- "just give me everything"
 * or "only Ana and Bob, last month" -- required first bending the dashboard to match.
 * This asks the three questions that decide the file instead: how far back, about whom,
 * and which sheets.
 *
 * It opens seeded from the dashboard's filters rather than from nothing, so the old
 * behaviour is one click away: open, confirm, download.
 */

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'Everything (all time)' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range…' },
];

const SECTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'summary', label: 'Summary', hint: 'Totals, balances and the filters used' },
  { value: 'expenses', label: 'Expenses', hint: 'One row per expense' },
  { value: 'splits', label: 'Expense splits', hint: 'Each person’s share of each expense' },
  { value: 'relationships', label: 'Person-wise', hint: 'Who paid for whom, and current dues' },
  { value: 'settlements', label: 'Settlements', hint: 'Payments recorded between members' },
  { value: 'period', label: 'Period breakdown', hint: 'Spending grouped by day, week or month' },
];

const CATEGORIES: { value: ExpenseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'food_dining', label: 'Food & Dining' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'travel', label: 'Travel' },
  { value: 'household', label: 'Household' },
  { value: 'medical', label: 'Medical' },
  { value: 'other', label: 'Other' },
];

export interface ExportRequest {
  params: URLSearchParams;
  /** For the toast, so the confirmation names what was actually produced. */
  summary: string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: PersonRef[];
  /** The dashboard's filters, used as the starting point. */
  filters: ReportFilters;
  isExporting: boolean;
  onExport: (request: ExportRequest) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  members,
  filters,
  isExporting,
  onExport,
}) => {
  const [preset, setPreset] = useState<DatePreset>(filters.preset);
  const [from, setFrom] = useState(filters.from ?? '');
  const [to, setTo] = useState(filters.to ?? '');
  const [everyone, setEveryone] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState<ExpenseCategory | 'all'>(filters.category ?? 'all');
  const [paymentMode, setPaymentMode] = useState<ReportFilters['paymentMode']>(
    filters.paymentMode,
  );
  const [sections, setSections] = useState<string[]>(SECTIONS.map((s) => s.value));

  // Re-seed each time it opens: the dashboard's filters may have changed since last time,
  // and a stale selection is worse than no selection when it silently narrows a file.
  useEffect(() => {
    if (!open) return;
    setPreset(filters.preset);
    setFrom(filters.from ?? '');
    setTo(filters.to ?? '');
    setCategory(filters.category ?? 'all');
    setPaymentMode(filters.paymentMode);
    setEveryone(filters.memberId === 'all');
    setSelected(filters.memberId === 'all' ? [] : [filters.memberId]);
    setSections(SECTIONS.map((s) => s.value));
  }, [open, filters]);

  const today = toLocalIsoDate(new Date());

  const range = useMemo(
    () => resolveDatePreset(preset, { from, to }),
    [preset, from, to],
  );

  const togglePerson = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const toggleSection = (value: string) =>
    setSections((current) =>
      current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
    );

  const customIncomplete = preset === 'custom' && (!from || !to);
  const rangeInverted = Boolean(from && to && from > to);
  const noPeople = !everyone && selected.length === 0;
  const noSections = sections.length === 0;
  const blocked = customIncomplete || rangeInverted || noPeople || noSections;

  const problem = rangeInverted
    ? 'The start date is after the end date.'
    : customIncomplete
      ? 'Pick both dates for a custom range.'
      : noPeople
        ? 'Choose at least one person, or switch back to everyone.'
        : noSections
          ? 'Choose at least one sheet to include.'
          : null;

  const peopleLabel = everyone
    ? 'everyone'
    : selected.length === 1
      ? (members.find((m) => m.id === selected[0])?.fullName ?? '1 person')
      : `${selected.length} people`;

  const submit = () => {
    if (blocked) return;

    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (!everyone) params.set('memberIds', selected.join(','));
    if (paymentMode !== 'all') params.set('paymentMode', paymentMode);
    if (category !== 'all') params.set('category', category);
    params.set('sections', sections.join(','));
    params.set('rangeLabel', range.label);
    params.set('preset', preset);

    onExport({ params, summary: `${range.label} · ${peopleLabel}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Export to Excel
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* ---- Range ---- */}
          <section className="space-y-2">
            <Label>Period</Label>
            <Select value={preset} onValueChange={(value) => setPreset(value as DatePreset)}>
              <SelectTrigger aria-label="Period to export">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={from}
                  max={to || today}
                  onChange={(event) => setFrom(event.target.value)}
                  aria-label="Export from date"
                />
                <span className="shrink-0 text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={today}
                  onChange={(event) => setTo(event.target.value)}
                  aria-label="Export to date"
                />
              </div>
            )}
          </section>

          {/* ---- People ---- */}
          <section className="space-y-2">
            <Label>People</Label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEveryone(true)}
                className={cn(
                  'press flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  everyone
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent',
                )}
                aria-pressed={everyone}
              >
                Whole group
              </button>
              <button
                type="button"
                onClick={() => setEveryone(false)}
                className={cn(
                  'press flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !everyone
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent',
                )}
                aria-pressed={!everyone}
              >
                Pick people
              </button>
            </div>

            {!everyone && (
              <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
                {members.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No members to choose from.
                  </p>
                ) : (
                  members.map((person) => {
                    const checked = selected.includes(person.id);
                    return (
                      <label
                        key={person.id}
                        className={cn(
                          'flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-md px-2 transition-colors',
                          checked ? 'bg-primary/10' : 'hover:bg-accent',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePerson(person.id)}
                          aria-label={person.fullName}
                        />
                        <span
                          aria-hidden
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
                        >
                          {initialsOf(person.fullName)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {person.fullName}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}

            <p className="flex items-center gap-1.5 t-meta">
              <Users2 className="h-3.5 w-3.5" />
              {everyone
                ? 'Every expense and settlement in the group.'
                : 'Only rows where one of these people paid, owed a share, or settled.'}
            </p>
          </section>

          {/* ---- Narrowing ---- */}
          <section className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as ExpenseCategory | 'all')}
              >
                <SelectTrigger aria-label="Category to export">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <Select
                value={paymentMode}
                onValueChange={(value) =>
                  setPaymentMode(value as ReportFilters['paymentMode'])
                }
              >
                <SelectTrigger aria-label="Payment method to export">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any method</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* ---- Sheets ---- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Sheets to include</Label>
              <button
                type="button"
                onClick={() =>
                  setSections(
                    sections.length === SECTIONS.length ? [] : SECTIONS.map((s) => s.value),
                  )
                }
                className="rounded px-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {sections.length === SECTIONS.length ? 'Clear all' : 'Select all'}
              </button>
            </div>

            <div className="space-y-0.5 rounded-lg border border-border p-1">
              {SECTIONS.map((section) => (
                <label
                  key={section.value}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 transition-colors',
                    sections.includes(section.value) ? 'bg-primary/10' : 'hover:bg-accent',
                  )}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={sections.includes(section.value)}
                    onCheckedChange={() => toggleSection(section.value)}
                    aria-label={section.label}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{section.label}</span>
                    <span className="block t-meta">{section.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* ---- What you are about to get ---- */}
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="t-eyebrow">You will download</p>
            <p className="mt-1 text-sm">
              <span className="font-semibold">{range.label}</span> · {peopleLabel} ·{' '}
              {sections.length} {sections.length === 1 ? 'sheet' : 'sheets'}
              {category !== 'all' && <> · {CATEGORIES.find((c) => c.value === category)?.label}</>}
              {paymentMode !== 'all' && <> · {paymentMode.toUpperCase()}</>}
            </p>
            {problem && (
              <p className="mt-1.5 text-xs font-semibold text-destructive">{problem}</p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={blocked || isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting ? 'Preparing…' : 'Download .xlsx'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
