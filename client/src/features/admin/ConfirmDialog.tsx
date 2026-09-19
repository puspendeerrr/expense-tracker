import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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

/**
 * Confirmation for an action with consequences.
 *
 * `confirmText` adds a retype step for the genuinely irreversible ones. It is
 * deliberately not applied to everything: a confirmation people meet constantly stops
 * being read, and then it protects nothing.
 */
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  isBusy?: boolean;
  /** When set, the operator must type this exact string to enable the button. */
  confirmText?: string;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  isBusy = false,
  confirmText,
  onConfirm,
}) => {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const satisfied = !confirmText || typed.trim() === confirmText.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="h-4 w-4 text-destructive" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          {confirmText && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-text">
                Type <span className="font-semibold text-foreground">{confirmText}</span> to
                confirm
              </Label>
              <Input
                id="confirm-text"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={confirmText}
                autoComplete="off"
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isBusy || !satisfied}
          >
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
