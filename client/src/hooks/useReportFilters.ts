import { useState, useCallback, useMemo } from 'react';

/**
 * Shared report-filter state and date resolution.
 *
 * This is the ONLY place the app turns a preset into a concrete date range. The dashboard and the
 * Excel export both read from here, so an export can never silently use a different window than
 * the one on screen.
 *
 * Timezone contract: presets resolve to the user's LOCAL day boundaries, then convert to absolute
 * ISO instants. `new Date(y, m, d)` builds local midnight and `.toISOString()` converts it to the
 * correct UTC instant, so a bare calendar date is never reinterpreted server-side and there is no
 * off-by-one at month or day edges.
 */

export type DatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'this_year'
  | 'all_time'
  | 'custom';

export type PaymentModeFilter = 'all' | 'cash' | 'upi';

export type InvolvementFilter =
  | 'all'
  | 'involving_me'
  | 'paid_by_me'
  | 'paid_by_others_for_me';

export interface ReportFilters {
  preset: DatePreset;
  customFrom: string | null; // YYYY-MM-DD
  customTo: string | null;   // YYYY-MM-DD
  memberId: string;          // 'all' or a member id
  paymentMode: PaymentModeFilter;
  involvement: InvolvementFilter;
}

export interface ResolvedRange {
  from: Date | null;
  to: Date | null;
  label: string;
}

export const DEFAULT_FILTERS: ReportFilters = {
  preset: 'this_month',
  customFrom: null,
  customTo: null,
  memberId: 'all',
  paymentMode: 'all',
  involvement: 'all',
};

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  last_30_days: 'Last 30 Days',
  this_year: 'This Year',
  all_time: 'All Time',
  custom: 'Custom Range',
};

export const INVOLVEMENT_LABELS: Record<InvolvementFilter, string> = {
  all: 'All Group Expenses',
  involving_me: 'Involving Me',
  paid_by_me: 'Paid By Me',
  paid_by_others_for_me: 'Paid By Others For Me',
};

export const PAYMENT_MODE_LABELS: Record<PaymentModeFilter, string> = {
  all: 'All Payments',
  cash: 'Cash',
  upi: 'UPI / Online',
};

/** Local midnight at the start of the given day. */
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

/** Local 23:59:59.999 of the given day. */
const endOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const fmtDay = (d: Date): string =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Parse a YYYY-MM-DD string as a LOCAL calendar date (never via Date.parse, which assumes UTC). */
const parseLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
};

/** Format a Date as a local YYYY-MM-DD string. */
export const toLocalDateString = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Resolve a filter set into absolute instants plus a human label.
 * `now` is injectable so this is testable and so callers can pin a render.
 */
export const resolveRange = (filters: ReportFilters, now: Date = new Date()): ResolvedRange => {
  const today = startOfDay(now);

  switch (filters.preset) {
    case 'today':
      return { from: today, to: endOfDay(now), label: `Today (${fmtDay(now)})` };

    case 'this_week': {
      // Week starts Monday, matching the server's bucketing.
      const daysFromMonday = (now.getDay() + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysFromMonday);
      return { from: monday, to: endOfDay(now), label: `This Week (${fmtDay(monday)} – ${fmtDay(now)})` };
    }

    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return {
        from: first,
        to: last,
        label: `${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
      };
    }

    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return {
        from: first,
        to: last,
        label: `${first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
      };
    }

    case 'last_30_days': {
      const start = new Date(today);
      start.setDate(today.getDate() - 29); // inclusive of today = 30 days
      return { from: start, to: endOfDay(now), label: `Last 30 Days (${fmtDay(start)} – ${fmtDay(now)})` };
    }

    case 'this_year': {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: first, to: endOfDay(now), label: `${now.getFullYear()}` };
    }

    case 'all_time':
      return { from: null, to: null, label: 'All Time' };

    case 'custom': {
      const from = filters.customFrom ? parseLocalDate(filters.customFrom) : null;
      const rawTo = filters.customTo ? parseLocalDate(filters.customTo) : null;
      const to = rawTo ? endOfDay(rawTo) : null;
      if (!from && !to) return { from: null, to: null, label: 'All Time' };
      const label =
        from && to ? `${fmtDay(from)} – ${fmtDay(to)}`
          : from ? `From ${fmtDay(from)}`
            : `Until ${fmtDay(to as Date)}`;
      return { from, to, label };
    }

    default:
      return { from: null, to: null, label: 'All Time' };
  }
};

/** Build the query string shared by the report endpoint and the export endpoint. */
export const buildReportQuery = (filters: ReportFilters, now: Date = new Date()): URLSearchParams => {
  const range = resolveRange(filters, now);
  const params = new URLSearchParams();

  if (range.from) params.set('from', range.from.toISOString());
  if (range.to) params.set('to', range.to.toISOString());
  if (filters.memberId && filters.memberId !== 'all') params.set('memberId', filters.memberId);
  params.set('paymentMode', filters.paymentMode);
  params.set('involvement', filters.involvement);
  params.set('preset', filters.preset);
  params.set('rangeLabel', range.label);
  // Minutes east of UTC, so server-side period bucketing matches the user's calendar.
  params.set('tz', String(-new Date().getTimezoneOffset()));

  return params;
};

/** True when a custom preset has been chosen but the dates are not yet usable. */
export const isRangeIncomplete = (filters: ReportFilters): boolean => {
  if (filters.preset !== 'custom') return false;
  if (!filters.customFrom || !filters.customTo) return true;
  const from = parseLocalDate(filters.customFrom);
  const to = parseLocalDate(filters.customTo);
  if (!from || !to) return true;
  return from.getTime() > to.getTime();
};

export const useReportFilters = (initial: Partial<ReportFilters> = {}) => {
  const [filters, setFilters] = useState<ReportFilters>({ ...DEFAULT_FILTERS, ...initial });

  const setFilter = useCallback(<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  const range = useMemo(() => resolveRange(filters), [filters]);

  const isDefault = useMemo(
    () =>
      filters.preset === DEFAULT_FILTERS.preset &&
      filters.memberId === DEFAULT_FILTERS.memberId &&
      filters.paymentMode === DEFAULT_FILTERS.paymentMode &&
      filters.involvement === DEFAULT_FILTERS.involvement,
    [filters]
  );

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.preset !== DEFAULT_FILTERS.preset) n++;
    if (filters.memberId !== 'all') n++;
    if (filters.paymentMode !== 'all') n++;
    if (filters.involvement !== 'all') n++;
    return n;
  }, [filters]);

  return { filters, setFilters, setFilter, reset, range, isDefault, activeCount };
};
