import React from 'react';
import { Check, X } from 'lucide-react';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password?: string;
  className?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthProps> = ({
  password = '',
  className,
}) => {
  const rules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number (0-9)', met: /[0-9]/.test(password) },
  ];

  const metCount = rules.filter((r) => r.met).length;
  const percentage = (metCount / rules.length) * 100;

  const strengthColor =
    metCount <= 1
      ? 'bg-red-500'
      : metCount <= 3
        ? 'bg-amber-500'
        : 'bg-emerald-600';

  if (!password) return null;

  return (
    <div className={cn('space-y-2 mt-2 pt-1', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Password strength</span>
        <span className="font-semibold text-foreground/80">
          {metCount === 4 ? 'Strong' : metCount >= 2 ? 'Medium' : 'Weak'}
        </span>
      </div>

      <Progress value={percentage} indicatorClassName={strengthColor} />

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              rule.met ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-muted-foreground',
            )}
          >
            {rule.met ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
            )}
            <span className="truncate">{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

