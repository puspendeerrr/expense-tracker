import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { buildUpiIntent, canOpenUpiApp, isValidUpiId, upiDisplayName } from '@/lib/upi';
import type { PersonRef } from '@/types/domain';

/**
 * Pay someone over UPI.
 *
 * On a phone this is a deep link that opens the payer's UPI app with everything
 * pre-filled. On desktop the identical intent string is rendered as a QR to scan.
 *
 * The person's own uploaded payment QR is preferred when they have one, because it is
 * what their bank issued and some users trust it more than a generated code; the
 * generated QR carries the exact amount, so both are offered rather than one replacing
 * the other.
 *
 * Nothing here records a payment. UPI gives the browser no confirmation callback, so
 * the user still tells us what they paid and the receiver still confirms it — the app
 * never assumes money moved because a link was opened.
 */

const QR_SIZE = 420;

interface UpiPayPanelProps {
  counterpart: PersonRef;
  amountPaise: number;
  groupName?: string;
}

export const UpiPayPanel: React.FC<UpiPayPanelProps> = ({
  counterpart,
  amountPaise,
  groupName,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBankQr, setShowBankQr] = useState(false);

  const payeeName = upiDisplayName(counterpart.fullName, counterpart.upiId);
  const intent = buildUpiIntent({
    upiId: counterpart.upiId ?? '',
    payeeName,
    amountPaise,
    note: groupName ? `SplitMoney ${groupName}` : 'SplitMoney',
  });

  const hasUpiId = isValidUpiId(counterpart.upiId);
  const hasBankQr = Boolean(counterpart.qrCodeUrl);
  const isMobile = canOpenUpiApp();

  useEffect(() => {
    if (!intent) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    setIsRendering(true);

    void QRCode.toDataURL(intent, {
      width: QR_SIZE,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // The deep link and the copyable VPA still work without a QR.
        if (!cancelled) setQrDataUrl(null);
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [intent]);

  const copyUpiId = async () => {
    if (!counterpart.upiId) return;
    try {
      await navigator.clipboard.writeText(counterpart.upiId);
      setCopied(true);
      toast.success('UPI ID copied');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — select the ID manually.');
    }
  };

  if (!hasUpiId && !hasBankQr) {
    return (
      <div className="rounded-xl bg-muted p-3">
        <p className="text-sm text-muted-foreground">
          {counterpart.fullName} has not added a UPI ID yet, so pay them however you
          usually do and record it below.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="t-eyebrow">Pay over UPI</p>
        {hasBankQr && hasUpiId && (
          <button
            type="button"
            onClick={() => setShowBankQr((current) => !current)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {showBankQr ? 'Show SplitMoney QR' : 'Show their own QR'}
          </button>
        )}
      </div>

      {/* ---- QR ---- */}
      <div className="mt-3 flex flex-col items-center">
        {showBankQr && counterpart.qrCodeUrl ? (
          <>
            <div className="rounded-2xl border border-white/20 bg-white p-2.5 shadow-lg">
              <img
                src={counterpart.qrCodeUrl}
                alt={`${counterpart.fullName}'s payment QR code`}
                className="h-40 w-40 object-contain"
              />
            </div>
            <p className="mt-2.5 max-w-[30ch] text-center t-meta">
              Their own QR — you will need to type the amount in.
            </p>
          </>
        ) : isRendering ? (
          <Skeleton className="h-40 w-40 rounded-2xl" />
        ) : qrDataUrl ? (
          <>
            <div className="rounded-2xl border border-white/20 bg-white p-2.5 shadow-lg">
              <img
                src={qrDataUrl}
                alt={`UPI QR code to pay ${payeeName}`}
                className="h-40 w-40"
                width={QR_SIZE}
                height={QR_SIZE}
              />
            </div>
            <p className="mt-2 max-w-[32ch] text-center t-meta">
              Scan with any UPI app — {formatPaise(amountPaise)} is already filled in.
            </p>
          </>
        ) : null}
      </div>

      {/* ---- Deep link ---- */}
      {intent && (
        <Button asChild className={cn('mt-3 w-full', !isMobile && 'sm:hidden')}>
          <a href={intent}>
            <Smartphone className="mr-2 h-4 w-4" />
            Pay {formatPaise(amountPaise)}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-70" />
          </a>
        </Button>
      )}

      {/* ---- VPA ---- */}
      {counterpart.upiId && (
        <button
          type="button"
          onClick={copyUpiId}
          className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-border px-3 font-mono text-sm text-foreground/80 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Copy UPI ID ${counterpart.upiId}`}
        >
          {counterpart.upiId}
          {copied ? (
            <Check className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Paying here does not record the settlement — UPI cannot tell us it succeeded.
        Confirm the amount below once you have paid.
      </p>
    </div>
  );
};
