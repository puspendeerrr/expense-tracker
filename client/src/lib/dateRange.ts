import type { DatePreset, ReportFilters } from '@/types/domain';

/**
 * Date presets resolved in the user's LOCAL calendar.
 *
 * The API takes plain `YYYY-MM-DD` days, so "today" means the user's today. Formatting
 * goes through local getters rather than `toISOString()`, which would shift the date
 * backwards for anyone west of UTC.
 */
export const toLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export type ResolvedRange = { from?: string; to?: string; label: string };

export const resolveDatePreset = (
  preset: DatePreset,
  custom?: { from?: string; to?: string },
): ResolvedRange => {
  const now = new Date();
  const today = toLocalIsoDate(now);

  switch (preset) {
    case 'today':
      return { from: today, to: today, label: 'Today' };

    case 'this_week': {
      // Week starts Monday, matching how the server labels its buckets.
      const dayOfWeek = (now.getDay() + 6) % 7;
      return {
        from: toLocalIsoDate(addDays(now, -dayOfWeek)),
        to: today,
        label: 'This week',
      };
    }

    case 'this_month':
      return {
        from: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
        label: 'This month',
      };

    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: toLocalIsoDate(first),
        to: toLocalIsoDate(last),
        label: 'Last month',
      };
    }

    case 'last_30_days':
      return { from: toLocalIsoDate(addDays(now, -29)), to: today, label: 'Last 30 days' };

    case 'this_year':
      return {
        from: toLocalIsoDate(new Date(now.getFullYear(), 0, 1)),
        to: today,
        label: 'This year',
      };

    case 'custom':
      return {
        from: custom?.from,
        to: custom?.to,
        label:
          custom?.from && custom?.to
            ? `${formatDisplayDate(custom.from)} – ${formatDisplayDate(custom.to)}`
            : 'Custom range',
      };

    case 'all':
    default:
      return { label: 'All time' };
  }
};

export const DEFAULT_FILTERS: ReportFilters = {
  preset: 'all',
  memberId: 'all',
  paymentMode: 'all',
  involvement: 'all',
};

/** Serialises filters into the query the API expects. */
export const buildFilterQuery = (filters: ReportFilters): URLSearchParams => {
  const range = resolveDatePreset(filters.preset, { from: filters.from, to: filters.to });
  const params = new URLSearchParams();

  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  if (filters.memberId !== 'all') params.set('memberId', filters.memberId);
  if (filters.paymentMode !== 'all') params.set('paymentMode', filters.paymentMode);
  if (filters.involvement !== 'all') params.set('involvement', filters.involvement);
  if (filters.category) params.set('category', filters.category);
  params.set('rangeLabel', range.label);
  params.set('preset', filters.preset);

  return params;
};

/** How many filters differ from the defaults, for the "Filters · 2" badge. */
export const countActiveFilters = (filters: ReportFilters): number => {
  let count = 0;
  if (filters.preset !== 'all') count += 1;
  if (filters.memberId !== 'all') count += 1;
  if (filters.paymentMode !== 'all') count += 1;
  if (filters.involvement !== 'all') count += 1;
  if (filters.category) count += 1;
  return count;
};

export const formatDisplayDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  // Constructed as a local date so the label never shifts by a day.
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatRelativeDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;

  const date = new Date(year, month - 1, day);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((date.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > -7 && diffDays < 0) {
    return date.toLocaleDateString('en-IN', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
