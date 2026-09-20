import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Dialog.
 *
 * Radix handles the parts that are easy to get wrong by hand: it locks body scroll while
 * open (so the dashboard behind cannot scroll), restores focus and scroll position on
 * close, traps focus, and closes on Escape.
 *
 * Two shapes are offered because a filter picker and an expense form want different
 * things on a phone:
 *   - `centered`  a centred card, used for filters and confirmations
 *   - `sheet`     near-full-screen on mobile with its own scroll region, used for forms
 *
 * Both are centred cards on desktop. `sheet` is not a compressed desktop dialog: on a
 * phone it becomes a full-height surface with a fixed header, an independently
 * scrolling body and a sticky footer action.
 */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[#09090B]/80 backdrop-blur-md',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
      'duration-200',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const dialogContentVariants = cva(
  cn(
    'fixed z-50 flex flex-col bg-[#18181B] border border-white/[0.08] shadow-2xl shadow-black/90 text-foreground',
    'focus-visible:outline-none',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'data-[state=open]:duration-280 data-[state=closed]:duration-200 ease-sheet',
  ),
  {
    variants: {
      variant: {
        centered: cn(
          // Phone: inset card with a 16px gutter, capped so it never exceeds the
          // viewport; `max-h` plus a scrolling body keeps the actions reachable.
          'left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)] rounded-2xl',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
        ),
        sheet: cn(
          // Phone: full width, pinned to the bottom, nearly full height.
          'inset-x-0 bottom-0 top-auto w-full rounded-t-2xl',
          'max-h-[calc(100dvh-1.5rem)] h-[calc(100dvh-1.5rem)]',
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          // Tablet and up: a centred card again.
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-4rem)]',
          'sm:w-[calc(100vw-4rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
          'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0',
        ),
      },
    },
    defaultVariants: { variant: 'centered' },
  },
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  showCloseButton?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, variant, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ variant }), className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          // 44px touch target, comfortably above the 24px icon it contains.
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Fixed header. Does not scroll with the body. */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col gap-1 border-b border-border px-5 py-4 pr-14 sm:px-6 sm:py-5',
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

/**
 * The only scrolling region inside a dialog.
 *
 * `overscroll-contain` stops a scroll gesture that reaches the end of this list from
 * chaining to the page behind it, which is what makes touch scrolling feel contained
 * on a phone.
 */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5',
      className,
    )}
    {...props}
  />
);
DialogBody.displayName = 'DialogBody';

/**
 * Sticky footer for primary actions.
 *
 * The bottom safe-area inset keeps the submit button clear of the iOS home indicator
 * and Android gesture bar.
 */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Column order on mobile puts the primary action last, i.e. lowest on screen and
      // easiest to reach with a thumb; the row reverts to the conventional
      // secondary-then-primary order from `sm` up.
      'flex shrink-0 flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6',
      'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold tracking-tight text-foreground', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm leading-relaxed text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
