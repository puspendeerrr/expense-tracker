import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasError, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // 16px on mobile: anything smaller makes iOS Safari zoom the viewport on
          // focus, which shifts the whole layout. Drops to 14px from `sm` up, where
          // there is no zoom behaviour to avoid.
          'flex h-11 w-full rounded-lg border bg-card px-3.5 py-2 text-base sm:text-sm text-foreground transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          hasError
            ? 'border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive'
            : 'border-input hover:border-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };

