import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-950/40 hover:from-emerald-400 hover:to-teal-500 hover:-translate-y-0.5 hover:shadow-emerald-900/50 active:translate-y-0',
        destructive:
          'bg-red-600 text-white shadow-lg shadow-red-950/40 hover:bg-red-500 hover:-translate-y-0.5 active:translate-y-0',
        outline:
          'border border-white/[0.10] bg-[#18181B] text-slate-100 shadow-sm hover:bg-[#1F2937] hover:border-white/[0.18] hover:text-white hover:-translate-y-0.5 active:translate-y-0',
        secondary:
          'bg-[#1F2937] text-slate-100 border border-white/[0.08] hover:bg-[#283548] hover:border-white/[0.14] hover:-translate-y-0.5 active:translate-y-0',
        ghost:
          'text-slate-300 hover:bg-white/[0.08] hover:text-white',
        link: 'text-emerald-400 underline-offset-4 hover:underline hover:text-emerald-300 p-0 h-auto font-medium',
      },
      size: {
        default: 'h-11 px-4 py-2 text-sm',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, asChild = false, children, disabled, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
        className: cn(
          buttonVariants({ variant, size, className }),
          (children.props as { className?: string }).className,
        ),
        ...props,
      });
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

