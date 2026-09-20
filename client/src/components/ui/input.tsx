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
          'flex h-11 w-full rounded-xl border bg-[#111827]/80 px-3.5 py-2 text-base sm:text-sm text-slate-100 transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          hasError
            ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
            : 'border-white/[0.08] hover:border-white/[0.16] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
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

