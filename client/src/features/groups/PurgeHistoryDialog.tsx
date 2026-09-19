import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
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
import { ApiClientError } from '@/lib/api';
import {
  executePurge,
  previewPurge,
  type PurgeFilters,
  type PurgePreview,
} from '@/lib/domainApi';
import { formatPaise } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/dateRange';
import type { ExpenseCategory, PaymentMode, PersonRef } from '@/types/domain';

/**
 * Clear group history.
 *
 * This is the only irreversible action in the product, so the dialog is built to slow
 * the operator down rather than to be efficient: nothing can be deleted without first
 * seeing a count of what will go, and the group's name has to be retyped.
 *
 * The server refuses any range that would move a balance, and says which pairs are in
 * the way. That refusal is shown here in full rather than reduced to "not allowed",
 * because the useful next step -- settle up with those people, or pick a narrower
 * window -- is only obvious once you can see them.
 */

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
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

interface PurgeHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  /** Only the fields the member picker reads, so any caller with a member list fits. */
  members: Pick<PersonRef, 'id' | 'fullName'>[];
  onPurged: () => void;
  /**
   * Which endpoints to call. Defaults to the group-scoped, creator-only routes; the
   * admin console passes its own pair. Injected rather than branched on a flag so that
   * there is exactly one purge dialog, with one preview-then-confirm flow, however it
   * is reached -- and so neither caller can quietly acquire different safety rules.
   */
  api?: {
    preview: (groupId: string, filters: PurgeFilters) => Promise<PurgePreview>;
    execute: (
      groupId: string,
      filters: PurgeFilters & { confirmation: string },
    ) => Promise<unknown>;
  };
}

export const PurgeHistoryDialog: React.FC<PurgeHistoryDialogProps> = ({
  open,
  onOpenChange,
  groupId,
  groupName,
  members,
  onPurged,
  api = { preview: previewPurge, execute: executePurge },
}) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [memberId, setMemberId] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [paymentMode, setPaymentMode] = useState<string>('all');
  const [includeActivities, setIncludeActivities] = useState(true);
  const [confirmation, setConfirmation] = useState('');

  const [preview, setPreview] = useState<PurgePreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const today = toLocalIsoDate(new Date());
    const yearAgo = toLocalIsoDate(new Date(Date.now() - 365 * 86_400_000));
    setFrom(yearAgo);
    setTo(today);
    setMemberId('all');
    setCategory('all');
    setPaymentMode('all');
    setIncludeActivities(true);
    setConfirmation('');
    setPreview(null);
    setError(null);
    setIsPurging(false);
  }, [open]);

  const filters = useCallback(
    () => ({
      from,
      to,
      ...(memberId !== 'all' ? { memberId } : {}),
      ...(category !== 'all' ? { category: category as ExpenseCategory } : {}),
      ...(paymentMode !== 'all' ? { paymentMode: paymentMode as PaymentMode } : {}),
      includeActivities,
    }),
    [from, to, memberId, category, paymentMode, includeActivities],
  );

  // Any change to the filters invalidates the preview: acting on a stale count is
  // exactly the mistake this screen exists to prevent.
  useEffect(() => {
    setPreview(null);
    setConfirmation('');
  }, [from, to, memberId, category, paymentMode, includeActivities]);

  const runPreview = async () => {
    if (!from || !to) {
      setError('Choose both dates.');
      return;
    }
    setIsPreviewing(true);
    setError(null);
    try {
      setPreview(await api.preview(groupId, filters()));
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not check that range.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const runPurge = async () => {
    if (isPurging) return;
    setIsPurging(true);
    setError(null);
    try {
      await api.execute(groupId, { ...filters(), confirmation });
      onPurged();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not clear that history.');
      // Re-preview so the operator sees the current state rather than the stale one.
      void runPreview();
    } finally {
      setIsPurging(false);
    }
  };

  const nothingMatched =
    preview !== null &&
    preview.expenseCount === 0 &&
    preview.settlementCount === 0 &&
    preview.activityCount === 0;

  const canPurge =
    preview !== null &&
    preview.safe &&
    !nothingMatched &&
    confirmation.trim() === groupName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            Clear history
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-900 dark:text-amber-300">
              This permanently deletes expenses and payments. It cannot be undone, and it
              is not an export &mdash; download a report first if you want a copy.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purge-from">From</Label>
              <Input
                id="purge-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purge-to">To</Label>
              <Input
                id="purge-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purge-member">Person</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger id="purge-member">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purge-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="purge-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purge-mode">Paid by</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger id="purge-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any method</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border px-3">
            <Checkbox
              checked={includeActivities}
              onCheckedChange={(next) => setIncludeActivities(next === true)}
            />
            <span className="text-sm text-foreground/80">
              Also clear the activity feed for this period
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {/* ---- Preview ---- */}
          {preview === null ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isPreviewing}
              onClick={() => void runPreview()}
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking&hellip;
                </>
              ) : (
                'Check what this would delete'
              )}
            </Button>
          ) : (
            <div className="animate-fade-in-up space-y-3">
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-muted px-3 py-2">
                  <span className="t-eyebrow">Would be deleted</span>
                </div>
                <dl className="divide-y divide-border">
                  {[
                    ['Expenses', String(preview.expenseCount)],
                    ['Payments', String(preview.settlementCount)],
                    ['Activity entries', String(preview.activityCount)],
                    ['Total value', formatPaise(preview.amountPaise)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2">
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {nothingMatched ? (
                <p className="text-sm text-muted-foreground">
                  Nothing matches that range. Widen the dates or clear a filter.
                </p>
              ) : preview.safe ? (
                <>
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm text-emerald-900 dark:text-emerald-300">
                      Everything in this range is settled, so clearing it will not change
                      what anyone owes.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="purge-confirm">
                      Type <span className="font-semibold">{groupName}</span> to confirm
                    </Label>
                    <Input
                      id="purge-confirm"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      placeholder={groupName}
                      autoComplete="off"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-sm text-foreground">
                      This range still has money owed in it. Clearing it would change what
                      people owe, so it is blocked. Settle these first, or pick a narrower
                      range.
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {preview.blockingDebts.map((debt) => (
                      <li
                        key={`${debt.debtorId}-${debt.creditorId}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate text-foreground/80">
                          {debt.debtorName} &rarr; {debt.creditorName}
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {formatPaise(Math.abs(debt.beforePaise))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canPurge || isPurging}
            onClick={() => void runPurge()}
            className={cn(!canPurge && 'opacity-60')}
          >
            {isPurging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing&hellip;
              </>
            ) : (
              'Clear permanently'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
