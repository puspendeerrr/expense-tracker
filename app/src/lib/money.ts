/**
 * Money FORMATTING. Not money arithmetic.
 *
 * Every figure this app shows is computed by the server's balance engine and arrives as
 * integer paise. Nothing here adds, nets, splits or rounds a balance — the only thing
 * these functions do is decide how an amount the server already decided should read on a
 * phone screen.
 *
 * The one operation that looks like arithmetic is `paiseToRupees`, which is a unit
 * conversion for display. It never feeds a value back to the server: amounts are sent as
 * the rupee string the user typed, and the server converts them to paise itself.
 */

/** Indian digit grouping: 12,34,567.89 rather than 1,234,567.89. */
const formatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole rupees, for headline figures where two decimals are noise. */
const wholeFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const paiseToRupees = (paise: number): number => paise / 100;

/**
 * The standard way an amount appears. `compact` drops the paise when they are zero,
 * which is the common case and reads far better in a list.
 */
export const formatPaise = (paise: number, options?: { compact?: boolean }): string => {
  const abs = Math.abs(paise);
  const rupees = paiseToRupees(abs);
  const sign = paise < 0 ? '-' : '';
  const body =
    options?.compact && abs % 100 === 0 ? wholeFormatter.format(rupees) : formatter.format(rupees);
  return sign + '₹' + body;
};

/** A currency code the server supplied, shown as-is when it is not the default. */
export const formatWithCurrency = (paise: number, currency: string): string =>
  currency === 'INR' ? formatPaise(paise, { compact: true }) : formatPaise(paise) + ' ' + currency;

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Expense dates are calendar days (`YYYY-MM-DD`), deliberately not timestamps, so they
 * are parsed as plain numbers rather than through `Date.parse`, which would apply a
 * timezone and could shift the day.
 */
export const formatExpenseDate = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** Full instants (createdAt, paidAt) are real timestamps and are parsed normally. */
export const formatInstant = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

/** Today's local calendar day, in the format the expense API expects. */
export const todayIso = (): string => {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
};

/**
 * Day bucket for the activity feed. Compares calendar days in local time, because
 * "yesterday" means the user's yesterday, not a 24-hour window.
 */
export const dayBucket = (iso: string): 'Today' | 'Yesterday' | 'Earlier' => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Earlier';

  const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return 'Earlier';
};

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export const CATEGORIES = [
  'groceries',
  'food_dining',
  'rent',
  'utilities',
  'entertainment',
  'travel',
  'household',
  'medical',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  groceries: 'Groceries',
  food_dining: 'Food & dining',
  rent: 'Rent',
  utilities: 'Utilities',
  entertainment: 'Entertainment',
  travel: 'Travel',
  household: 'Household',
  medical: 'Medical',
  other: 'Other',
};

export const categoryLabel = (value: string | null): string =>
  value && value in CATEGORY_LABELS ? CATEGORY_LABELS[value as Category] : 'Uncategorised';

export const SPLIT_MODES = ['everyone', 'specific', 'exact', 'percentage', 'shares'] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const SPLIT_LABELS: Record<SplitMode, string> = {
  everyone: 'Everyone',
  specific: 'Only some people',
  exact: 'Exact amounts',
  percentage: 'Percentages',
  shares: 'Shares',
};

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  paid_pending_approval: 'Awaiting confirmation',
  will_pay_soon: 'Promised',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
