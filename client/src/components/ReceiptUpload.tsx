import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { UploadError, uploadImage } from '@/lib/upload';

/**
 * Receipt / proof image attachment.
 *
 * Uploads straight to Cloudinary from the browser with an unsigned preset, so the image
 * never transits our server and no API secret reaches the client. Images are compressed
 * first: a receipt photographed on a phone is routinely 4-8MB and will be viewed at a
 * few hundred pixels.
 *
 * When Cloudinary is not configured the component says so plainly rather than offering a
 * control that silently fails.
 */

interface ReceiptUploadProps {
  value: string | null;
  onChange: (next: { url: string; publicId: string } | null) => void;
  label?: string;
  folder?: string;
  disabled?: boolean;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({
  value,
  onChange,
  label = 'Receipt',
  folder,
  disabled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isUploading = progress !== null;

  if (!env.cloudinary.isConfigured) {
    return (
      <div className="rounded-xl bg-muted p-3">
        <p className="t-eyebrow mb-1">{label}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Image uploads are not configured on this deployment. Set{' '}
          <code className="rounded bg-accent px-1">VITE_CLOUDINARY_CLOUD_NAME</code> and{' '}
          <code className="rounded bg-accent px-1">VITE_CLOUDINARY_UPLOAD_PRESET</code>.
        </p>
      </div>
    );
  }

  const handleFile = async (file: File) => {
    setError(null);
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await uploadImage(file, {
        folder,
        signal: controller.signal,
        onProgress: setProgress,
      });
      onChange({ url: result.url, publicId: result.publicId });
      toast.success('Image attached');
    } catch (err: unknown) {
      const message =
        err instanceof UploadError ? err.message : 'That image could not be uploaded.';
      // Cancelling is a deliberate user action, not an error worth shouting about.
      if (!controller.signal.aborted) {
        setError(message);
        toast.error(message);
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
      // Allow re-selecting the same file after a failure.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="t-eyebrow">{label}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // Prompts the camera directly on a phone, which is how receipts get captured.
        capture="environment"
        className="sr-only"
        disabled={disabled || isUploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
          <img
            src={value}
            alt="Attached receipt"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Image attached</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Replace
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 text-destructive hover:bg-red-500/10"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Remove image"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : isUploading ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="flex-1 text-sm text-foreground/80">Uploading… {progress}%</span>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="text-xs font-semibold text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </div>
          <Progress value={progress ?? 0} className="mt-2 h-1.5" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted px-3 text-sm font-medium text-muted-foreground transition-colors',
            'hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <Camera className="h-4 w-4 text-muted-foreground" />
          Take a photo or choose an image
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
