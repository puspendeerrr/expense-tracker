import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputOTPProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const InputOTP: React.FC<InputOTPProps> = ({
  value = '',
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  className,
  autoFocus = true,
}) => {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  React.useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const updateValueAtIndex = (index: number, newChar: string) => {
    const chars = [...digits];
    chars[index] = newChar;
    const combined = chars.join('').slice(0, 6);
    onChange(combined);

    if (newChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (combined.length === 6 && onComplete) {
      onComplete(combined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous and clear it
        e.preventDefault();
        updateValueAtIndex(index - 1, '');
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current
        e.preventDefault();
        updateValueAtIndex(index, '');
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digit = raw.replace(/\D/g, '').slice(-1);
    updateValueAtIndex(index, digit);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    onChange(pasted);

    const nextFocusIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();

    if (pasted.length === 6 && onComplete) {
      onComplete(pasted);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 sm:gap-3',
        hasError && 'animate-shake',
        className,
      )}
      onPaste={handlePaste}
    >
      {Array.from({ length: 6 }).map((_, index) => {
        const isFilled = Boolean(digits[index]);

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            disabled={disabled}
            value={digits[index]}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            aria-label={`Digit ${index + 1} of 6`}
            className={cn(
              'h-12 w-10 sm:h-14 sm:w-12 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl border bg-white text-slate-900 transition-all duration-150',
              'outline-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
              hasError
                ? 'border-destructive text-destructive focus:border-destructive focus:ring-destructive'
                : isFilled
                  ? 'border-primary/60 bg-emerald-50/20 text-slate-900'
                  : 'border-slate-300 hover:border-slate-400',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-100',
            )}
          />
        );
      })}
    </div>
  );
};
