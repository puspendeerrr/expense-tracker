import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { createSettlement, getOutstanding } from '@/lib/domainApi';
import { formatPaise, parseRupeesToPaise, paiseToRupeeString } from '@/lib/money';
import type { PaymentMode, PersonRef } from '@/types/domain';
import { UpiPayPanel } from './UpiPayPanel';

/**
 * Settle up with one person.
 *
 * The outstanding figure is fetched fresh from the server when the dialog opens rather
 * than taken from whatever the dashboard last rendered. That matters: the amount offered
 * here is the amount the server will accept, so a stale screen cannot lead someone into
 * an over-settlement rejection.
 *
 * Over-settlement is blocked client-side for a good error message, and independently by
 * the server, which is the actual guarantee.
 */

interface SettleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  counterpart: PersonRef | null;
  /** Used as the UPI transaction note so the payment is identifiable in their app. */
  groupName?: string;
  onSettled: () => void;
}

export const SettleDialog: React.FC<SettleDialogProps> = ({
  open,
  onOpenChange,
  groupId,
  counterpart,
  groupName,
  onSettled,
}) => {
  const [outstandingPaise, setOutstandingPaise] = useState<number | null>(null);
  const [isLoadingOutstanding, setIsLoadingOutstanding] = useState(true);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>('cash');
  const [actionType, setActionType] = useState<'payment' | 'will_pay_soon'>('payment');
  const [proofUrl, setProofUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !counterpart) return;

    let cancelled = false;
    setIsLoadingOutstanding(true);
    setError(null);
    setFieldError(null);
    setNote('');
    setProofUrl('');
    setPaymentMethod('cash');
    setActionType('payment');

    void getOutstanding(groupId, counterpart.id)
      .then((data) => {
        if (cancelled) return;
        setOutstandingPaise(data.maxSettleablePaise);
        // Default to settling in full, the overwhelmingly common case.
        setAmount(paiseToRupeeString(data.maxSettleablePaise));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the outstanding amount.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOutstanding(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, counterpart, groupId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !counterpart) return;

    const paise = parseRupeesToPaise(amount);
    if (paise === null || paise <= 0) {
      setFieldError('Enter a valid amount.');
      return;
    }
    if (outstandingPaise !== null && paise > outstandingPaise) {
      setFieldError(`You only owe ${formatPaise(outstandingPaise)} to this person.`);
      return;
    }
    if (actionType === 'payment' && paymentMethod === 'upi' && !proofUrl.trim()) {
      setFieldError('Add a link to your payment screenshot for UPI settlements.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldError(null);

    try {
      await createSettlement(groupId, {
        receiverId: counterpart.id,
        amount,
        paymentMethod,
        actionType,
        proofUrl: proofUrl.trim() || null,
        note: note.trim(),
      });
      onSettled();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settle up</DialogTitle>
          <DialogDescription>
            {counterpart ? `Record a payment to ${counterpart.fullName}.` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLoadingOutstanding ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  You currently owe
                </p>
                <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-foreground">
                  {formatPaise(outstandingPaise ?? 0)}
                </p>
              </div>
            )}

            {/* Pay first, then record. The panel is only useful while a debt exists. */}
            {counterpart && (outstandingPaise ?? 0) > 0 && !isLoadingOutstanding && (
              <UpiPayPanel
                counterpart={counterpart}
                amountPaise={parseRupeesToPaise(amount) ?? outstandingPaise ?? 0}
                groupName={groupName}
              />
            )}

            {/* Action type */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'payment', label: 'I paid' },
                  { value: 'will_pay_soon', label: 'Will pay soon' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActionType(option.value)}
                  aria-pressed={actionType === option.value}
                  className={cn(
                    'min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    actionType === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settle-amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="settle-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setFieldError(null);
                  }}
                  className="pl-8"
                  aria-invalid={Boolean(fieldError)}
                />
              </div>
              {fieldError && (
                <p role="alert" className="text-sm text-destructive">
                  {fieldError}
                </p>
              )}
            </div>

            {actionType === 'payment' && (
              <>
                <div className="space-y-2">
                  <Label>Paid by</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'cash', label: 'Cash' },
                        { value: 'upi', label: 'UPI / Online' },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPaymentMethod(option.value)}
                        aria-pressed={paymentMethod === option.value}
                        className={cn(
                          'min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          paymentMethod === option.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'upi' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="settle-proof">Payment screenshot link</Label>
                    <Input
                      id="settle-proof"
                      value={proofUrl}
                      onChange={(event) => setProofUrl(event.target.value)}
                      placeholder="https://…"
                      inputMode="url"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for UPI so the receiver can verify the transfer.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="settle-note">Note (optional)</Label>
              <Textarea
                id="settle-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
              />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {counterpart?.fullName} confirms the payment before it reduces your balance.
            </p>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingOutstanding}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
