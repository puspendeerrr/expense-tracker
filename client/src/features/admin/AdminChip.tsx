import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Small status label used across the admin screens.
 *
 * Colour never carries the meaning on its own -- the word is always present -- so the
 * chips stay readable for colour-blind users and in dark mode, where the palette shifts.
 */
export const Chip: React.FC<{
  tone?: 'ok' | 'bad' | 'warn' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'neutral', children, className }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
      tone === 'ok' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      tone === 'bad' && 'bg-destructive/10 text-destructive',
      tone === 'warn' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      tone === 'info' && 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      tone === 'neutral' && 'bg-muted text-muted-foreground',
      className,
    )}
  >
    {children}
  </span>
);

/** Maps a settlement status to a tone, so every screen labels them identically. */
export const settlementTone = (status: string): 'ok' | 'bad' | 'warn' | 'neutral' => {
  if (status === 'completed') return 'ok';
  if (status === 'rejected' || status === 'cancelled') return 'bad';
  if (status === 'paid_pending_approval') return 'warn';
  return 'neutral';
};

export const prettyStatus = (status: string): string => status.replace(/_/g, ' ');
