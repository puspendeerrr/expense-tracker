import React from 'react';
import {
  Ban,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  FileImage,
  Loader2,
  Users2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import type { PersonRef, Settlement, SettlementStatus } from '@/types/domain';

/**
 * Everything about one settlement.
 *
 * A settlement row in a list answers "how much, to whom, what state". This answers the
 * questions people actually arrive with when something looks wrong: when did each step
 * happen, who acted, what was the debt before it, and what is left afterwards.
 *
 * The outstanding figure is the server's, taken from the authoritative balance engine
 * and passed in -- never recomputed here from the amounts on screen. Two places
 * calculating what someone owes is how the two end up disagreeing, and a settlement
 * screen is the worst place to discover that.
 */

const STATUS_LABEL: Record<SettlementStatus, string> = {
  will_pay_soon: 'Payment promised',
  paid_pending_approval: 'Awaiting confirmation',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<SettlementStatus, string> = {
  will_pay_soon: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  paid_pending_approval: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  rejected: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const when = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

/* ------------------------------------------------------------------ timeline */

type Step = {
  label: string;
  at: string | null;
  detail?: string;
  state: 'done' | 'failed' | 'pending';
};

/**
 * The life of this settlement, as far as the record can actually show it.
 *
 * Steps with no timestamp are drawn as pending rather than given an invented one. A
 * timeline that fills gaps with plausible-looking times is worse than one with holes,
 * because it cannot be told apart from a real record.
 */
const buildTimeline = (settlement: Settlement, payer: string): Step[] => {
  const steps: Step[] = [
    {
      label: `${payer} recorded a payment`,
      at: settlement.createdAt,
      detail: `${formatPaise(settlement.amountPaise)} by ${settlement.paymentMethod.toUpperCase()}`,
      state: 'done',
    },
  ];

  if (settlement.hasProof) {
    steps.push({
      // The record carries no separate upload time, so it is attributed to the payment
      // rather than dated with a guess.
      label: 'Proof attached',
      at: null,
      detail: 'A receipt or screenshot was provided',
      state: 'done',
    });
  }

  if (settlement.status === 'completed') {
    steps.push({
      label: 'Confirmed by the receiver',
      at: settlement.verifiedAt,
      state: 'done',
    });
  } else if (settlement.status === 'rejected') {
    steps.push({
      label: 'Rejected by the receiver',
      at: settlement.verifiedAt,
      detail: settlement.rejectionReason || undefined,
      state: 'failed',
    });
  } else if (settlement.status === 'cancelled') {
    steps.push({ label: 'Cancelled', at: settlement.verifiedAt, state: 'failed' });
  } else {
    steps.push({
      label: 'Waiting for the receiver to confirm',
      at: null,
      state: 'pending',
    });
  }

  return steps;
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
  </div>
);

interface SettlementDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settlement: Settlement | null;
  groupName: string;
  nameOf: (userId: string) => string;
  counterpart: PersonRef | null;
  /** Live debt between the two, from the balance engine. Null while unknown. */
  outstandingPaise: number | null;
  isBusy: boolean;
  canApprove: boolean;
  canCancel: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onViewProof: () => void;
  onViewRelatedExpenses: () => void;
}

export const SettlementDetail: React.FC<SettlementDetailProps> = ({
  open,
  onOpenChange,
  settlement,
  groupName,
  nameOf,
  counterpart,
  outstandingPaise,
  isBusy,
  canApprove,
  canCancel,
  onApprove,
  onReject,
  onCancel,
  onViewProof,
  onViewRelatedExpenses,
}) => {
  if (!settlement) return null;

  const payer = nameOf(settlement.payerId);
  const receiver = nameOf(settlement.receiverId);
  const timeline = buildTimeline(settlement, payer);

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Could not copy that.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settlement</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* ---- Headline ---- */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-center">
            <p className="t-money text-2xl">{formatPaise(settlement.amountPaise)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {payer} &rarr; {receiver}
            </p>
            <span
              className={cn(
                'mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                STATUS_TONE[settlement.status],
              )}
            >
              {STATUS_LABEL[settlement.status]}
            </span>
          </div>

          {/* ---- Facts ---- */}
          <dl className="divide-y divide-border rounded-xl border border-border px-3.5 py-1">
            <Row label="Group">{groupName}</Row>
            <Row label="Payment method">{settlement.paymentMethod.toUpperCase()}</Row>
            <Row label="Recorded">{when(settlement.createdAt)}</Row>
            <Row label="Paid on">{when(settlement.paidAt)}</Row>
            {settlement.status === 'completed' && (
              <Row label="Confirmed">{when(settlement.verifiedAt)}</Row>
            )}
            <Row label="Still outstanding">
              {outstandingPaise === null ? (
                <span className="text-muted-foreground">—</span>
              ) : outstandingPaise === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">Settled up</span>
              ) : (
                <span className="t-money">{formatPaise(outstandingPaise)}</span>
              )}
            </Row>
            {settlement.note && <Row label="Note">{settlement.note}</Row>}
            {settlement.rejectionReason && (
              <Row label="Reason">
                <span className="text-destructive">{settlement.rejectionReason}</span>
              </Row>
            )}
          </dl>

          <p className="t-meta">
            The outstanding figure comes from the group&rsquo;s balance engine, not from
            this payment alone, so it already accounts for every other expense and
            settlement between you.
          </p>

          {/* ---- Timeline ---- */}
          <section className="space-y-2">
            <h3 className="t-eyebrow">Timeline</h3>
            <ol className="space-y-0">
              {timeline.map((step, index) => (
                <li key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        step.state === 'done' &&
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        step.state === 'failed' && 'bg-destructive/10 text-destructive',
                        step.state === 'pending' &&
                          'border border-dashed border-border text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {step.state === 'done' ? (
                        <Check className="h-3 w-3" />
                      ) : step.state === 'failed' ? (
                        <X className="h-3 w-3" />
                      ) : (
                        <Loader2 className="h-3 w-3" />
                      )}
                    </span>
                    {index < timeline.length - 1 && (
                      <span className="w-px flex-1 bg-border" aria-hidden />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pb-3">
                    <p className="text-sm font-medium">{step.label}</p>
                    {step.detail && <p className="t-meta">{step.detail}</p>}
                    <p className="t-meta">{step.at ? when(step.at) : 'no timestamp recorded'}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ---- Related ---- */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-11 justify-start" onClick={onViewRelatedExpenses}>
              <Users2 className="mr-2 h-4 w-4" />
              View related expenses
            </Button>

            {settlement.hasProof && (
              <Button variant="outline" className="h-11 justify-start" onClick={onViewProof}>
                <FileImage className="mr-2 h-4 w-4" />
                View payment proof
              </Button>
            )}

            {counterpart?.upiId && (
              <Button
                variant="outline"
                className="h-11 justify-start"
                onClick={() => void copy(counterpart.upiId!, 'UPI ID')}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy UPI ID
              </Button>
            )}

            <Button
              variant="outline"
              className="h-11 justify-start"
              onClick={() => void copy(formatPaise(settlement.amountPaise), 'Amount')}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Copy amount
            </Button>
          </div>
        </DialogBody>

        <DialogFooter>
          {canCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isBusy}>
              <Ban className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          {canApprove && (
            <>
              <Button variant="outline" onClick={onReject} disabled={isBusy}>
                <X className="mr-2 h-4 w-4 text-destructive" />
                Reject
              </Button>
              <Button onClick={onApprove} disabled={isBusy}>
                {isBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Confirm payment
              </Button>
            </>
          )}
          {!canApprove && !canCancel && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { ExternalLink };
