import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Check, Copy, Download, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { getShareInfo, regenerateInvite } from '@/lib/domainApi';

/**
 * Group invite sharing: QR code, human code and link.
 *
 * The QR is rendered locally from the invite URL — no third-party image service ever
 * sees the token. It is generated at 2x the displayed size so it stays crisp on high-DPI
 * screens and survives being screenshotted and re-scanned, which is how these codes
 * actually get passed around.
 */

const QR_RENDER_SIZE = 480;

interface ShareInfo {
  groupName: string;
  inviteCode: string;
  inviteToken: string;
  invitePath: string;
  memberCount: number;
  isCreator: boolean;
}

interface InviteShareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  /** Called after the invite is rotated, so callers can refresh cached codes. */
  onRotated?: () => void;
}

export const InviteShare: React.FC<InviteShareProps> = ({
  open,
  onOpenChange,
  groupId,
  onRotated,
}) => {
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = info ? `${window.location.origin}${info.invitePath}` : '';

  const renderQr = useCallback(async (url: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: QR_RENDER_SIZE,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch {
      // The code and link still work without the QR, so this is not fatal.
      setQrDataUrl(null);
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getShareInfo(groupId);
      setInfo(data);
      await renderQr(`${window.location.origin}${data.invitePath}`);
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not load the invite details.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [groupId, renderQr]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const copy = async (value: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === 'code' ? 'Invite code copied' : 'Invite link copied');
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error('Could not copy — you can select the text manually.');
    }
  };

  /** Uses the native share sheet where available; falls back to copying the link. */
  const share = async () => {
    if (!info) return;
    const payload = {
      title: `Join ${info.groupName} on SplitMoney`,
      text: `Join my group "${info.groupName}" on SplitMoney. Invite code: ${info.inviteCode}`,
      url: inviteUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // User dismissed the sheet, or sharing is blocked; fall through to copy.
      }
    }
    await copy(inviteUrl, 'link');
  };

  const downloadQr = () => {
    if (!qrDataUrl || !info) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `splitmoney-${info.inviteCode}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('QR code saved');
  };

  const rotate = async () => {
    if (isRotating) return;
    setIsRotating(true);
    try {
      const data = await regenerateInvite(groupId);
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              inviteCode: data.inviteCode,
              inviteToken: data.inviteToken,
              invitePath: data.invitePath,
            }
          : prev,
      );
      await renderQr(`${window.location.origin}${data.invitePath}`);
      toast.success('New invite created', {
        description: 'The previous code and link no longer work.',
      });
      onRotated?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'Could not regenerate the invite.',
      );
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {info?.groupName ?? 'this group'}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {error ? (
            <div className="rounded-xl bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={load}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* ---- QR ---- */}
              <div className="flex flex-col items-center">
                {isLoading ? (
                  <Skeleton className="h-52 w-52 rounded-2xl" />
                ) : qrDataUrl ? (
                  <div className="rounded-2xl border border-white/20 bg-white p-3.5 shadow-lg">
                    <img
                      src={qrDataUrl}
                      alt={`QR code to join ${info?.groupName}`}
                      className="h-44 w-44 sm:h-52 sm:w-52"
                      width={QR_RENDER_SIZE}
                      height={QR_RENDER_SIZE}
                    />
                  </div>
                ) : (
                  <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-dashed border-input text-center">
                    <p className="px-3 t-meta">
                      QR unavailable — use the code or link below.
                    </p>
                  </div>
                )}

                <p className="mt-3 max-w-[30ch] text-center t-meta">
                  Point a phone camera at this code to join instantly.
                </p>
              </div>

              {/* ---- Invite code ---- */}
              <div className="space-y-2">
                <p className="t-eyebrow">Or enter this code</p>
                {isLoading ? (
                  <Skeleton className="h-14 w-full rounded-xl" />
                ) : (
                  <button
                    type="button"
                    onClick={() => info && copy(info.inviteCode, 'code')}
                    className={cn(
                      'flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input bg-muted px-3 transition-colors',
                      'hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    aria-label={`Copy invite code ${info?.inviteCode}`}
                  >
                    <span className="font-mono text-2xl font-extrabold tracking-[0.35em] text-foreground">
                      {info?.inviteCode}
                    </span>
                    {copied === 'code' ? (
                      <Check className="h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <Copy className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>

              {/* ---- Link ---- */}
              <div className="space-y-2">
                <p className="t-eyebrow">Invite link</p>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {isLoading ? 'Loading…' : inviteUrl}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => copy(inviteUrl, 'link')}
                    disabled={isLoading}
                    aria-label="Copy invite link"
                  >
                    {copied === 'link' ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* ---- Share / save ---- */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={share} disabled={isLoading} className="flex-1">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share invite
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadQr}
                  disabled={!qrDataUrl}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Save QR
                </Button>
              </div>

              {/* ---- Rotate (creator only) ---- */}
              {info?.isCreator && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-300">
                    Regenerating creates a new code and link and immediately revokes the
                    current ones. Use it if an invite has been shared too widely.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rotate}
                    disabled={isRotating}
                    className="mt-2 w-full bg-card"
                  >
                    {isRotating ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                    )}
                    {isRotating ? 'Regenerating…' : 'Regenerate invite'}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
