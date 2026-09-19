import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import type { SplitEvaluation } from '@/lib/split';
import type { PersonRef, SplitType } from '@/types/domain';

/**
 * Per-person share editor for the three unequal split modes.
 *
 * The running remainder is the whole point of this component. The server refuses a
 * split that does not reconcile exactly, so the user needs to see the gap closing as
 * they type rather than discovering it on submit.
 *
 * Each row also shows the resolved rupee figure, because "2 shares" or "35%" means
 * nothing to someone trying to check they have been charged fairly.
 */

const MODE_COPY: Record<string, { suffix: string; placeholder: string; hint: string }> = {
  exact: {
    suffix: '₹',
    placeholder: '0.00',
    hint: 'Enter what each person actually owes.',
  },
  percentage: {
    suffix: '%',
    placeholder: '0',
    hint: 'Percentages must add up to 100%.',
  },
  shares: {
    suffix: '×',
    placeholder: '1',
    hint: 'Relative weights — 2 and 1 means twice as much.',
  },
};

interface SplitEditorProps {
  splitType: SplitType;
  members: PersonRef[];
  currentUserId: string;
  values: Record<string, string>;
  onChange: (userId: string, value: string) => void;
  evaluation: SplitEvaluation;
  amountPaise: number | null;
  error?: string;
}

export const SplitEditor: React.FC<SplitEditorProps> = ({
  splitType,
  members,
  currentUserId,
  values,
  onChange,
  evaluation,
  amountPaise,
  error,
}) => {
  const copy = MODE_COPY[splitType] ?? MODE_COPY.exact!;
  const shareByUser = new Map(evaluation.shares.map((row) => [row.userId, row.sharePaise]));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Each person&rsquo;s share</Label>
        <span className="text-xs text-slate-500">{copy.hint}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {members.map((member, index) => {
          const sharePaise = shareByUser.get(member.id) ?? 0;

          return (
            <div
              key={member.id}
              className={cn(
                'flex min-h-[56px] items-center gap-3 bg-white px-3 py-2',
                index > 0 && 'border-t border-slate-100',
              )}
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`split-${member.id}`}
                  className="block truncate text-sm font-medium text-slate-900"
                >
                  {member.id === currentUserId ? 'You' : member.fullName}
                </label>
                {amountPaise !== null && amountPaise > 0 && splitType !== 'exact' && (
                  <span className="t-meta">{formatPaise(sharePaise)}</span>
                )}
              </div>

              <div className="relative w-28 shrink-0">
                {splitType === 'exact' && (
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₹
                  </span>
                )}
                <Input
                  id={`split-${member.id}`}
                  inputMode="decimal"
                  value={values[member.id] ?? ''}
                  onChange={(event) => onChange(member.id, event.target.value)}
                  placeholder={copy.placeholder}
                  aria-label={`${
                    member.id === currentUserId ? 'Your' : `${member.fullName}'s`
                  } share`}
                  className={cn(
                    'text-right',
                    splitType === 'exact' ? 'pl-6' : 'pr-7',
                  )}
                />
                {splitType !== 'exact' && (
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {copy.suffix}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Running reconciliation: green once it adds up, plain while it does not. */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
          evaluation.isBalanced
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600',
        )}
      >
        {evaluation.isBalanced ? (
          <>
            <Check className="h-4 w-4 shrink-0" />
            <span>
              {splitType === 'shares'
                ? 'Shares are set'
                : splitType === 'percentage'
                  ? 'Adds up to 100%'
                  : 'Adds up to the total'}
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{evaluation.message ?? 'Enter each share'}</span>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
