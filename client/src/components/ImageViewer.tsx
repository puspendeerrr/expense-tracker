import React, { useState } from 'react';
import { Download, ExternalLink, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
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

/**
 * Full-size viewer for a receipt or payment proof.
 *
 * Zoom exists because these are photographs of paper: the figure someone needs to check
 * is often small and off-centre. At 2x the image scrolls in both directions rather than
 * being letterboxed, so the whole receipt stays reachable.
 */

interface ImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  title?: string;
  caption?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  open,
  onOpenChange,
  src,
  title = 'Attachment',
  caption,
}) => {
  const [zoomed, setZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setZoomed(false);
          setIsLoading(true);
          setFailed(false);
        }
      }}
    >
      <DialogContent variant="sheet" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col items-center justify-center bg-slate-900/[0.03] p-0">
          {failed ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-slate-600">
                This image could not be loaded. It may have been removed from storage.
              </p>
              {src && (
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <a href={src} target="_blank" rel="noreferrer noopener">
                    Open the original
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn(
                'flex w-full justify-center',
                zoomed ? 'overflow-auto' : 'items-center p-3',
              )}
            >
              {isLoading && (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              )}
              {src && (
                <img
                  src={src}
                  alt={caption ?? title}
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setFailed(true);
                  }}
                  className={cn(
                    'rounded-lg',
                    isLoading && 'hidden',
                    zoomed ? 'max-w-none' : 'max-h-[60dvh] w-auto max-w-full object-contain',
                  )}
                  style={zoomed ? { width: '200%' } : undefined}
                />
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="!flex-row items-center gap-2 sm:justify-between">
          {!failed && src && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setZoomed((current) => !current)}
              className="shrink-0 px-3"
              aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            >
              {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            </Button>
          )}

          {src && (
            <Button type="button" variant="outline" asChild className="shrink-0">
              <a href={src} target="_blank" rel="noreferrer noopener" download>
                <Download className="mr-1.5 h-4 w-4" />
                Open
              </a>
            </Button>
          )}

          <Button type="button" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
