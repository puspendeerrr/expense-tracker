import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

/**
 * Tooltip.
 *
 * Used to label icon-only controls, where the icon alone is a guess. It is a hint, never
 * the only way to know what a control does: touch devices have no hover, so every
 * icon-only button also carries an `aria-label`, which screen readers and Playwright
 * both rely on.
 */

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md border border-border bg-popover px-2.5 py-1.5',
        'text-xs font-medium text-popover-foreground shadow-md',
        'animate-scale-in',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * Convenience wrapper for the common case: one trigger, one line of text.
 *
 * Renders the trigger untouched when there is no label, so a caller can pass a possibly
 * empty hint without branching.
 */
export const Hint: React.FC<{
  label?: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}> = ({ label, children, side = 'top' }) => {
  if (!label) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
