import type { IconName } from '@/components/Icon';

/**
 * The icon for an expense category.
 *
 * Keyed on the nine values of the server's `expense_category` enum and nothing else. An
 * unknown category — including null, which the column permits — falls back to the generic
 * expense icon rather than being guessed at from the title. Reading a category out of free
 * text would attach a meaning to an expense that nobody recorded.
 */
const CATEGORY_ICONS: Record<string, IconName> = {
  groceries: 'tag',
  food_dining: 'tag',
  rent: 'group',
  utilities: 'settings',
  entertainment: 'activity',
  travel: 'send',
  household: 'group',
  medical: 'shield',
  other: 'expense',
};

export const categoryIcon = (category: string | null): IconName =>
  (category ? CATEGORY_ICONS[category] : undefined) ?? 'expense';

/**
 * The heading an expense belongs under in the ledger.
 *
 * Today and Yesterday are named; everything older gets its actual date, because in a
 * ledger the date IS the information — collapsing three months into "Earlier", as
 * `dayBucket` does for the activity feed, would make the list unreadable as a record.
 *
 * Grouping is on `expenseDate`, the date the spending happened, which is also what the
 * server sorts by. Using `createdAt` instead would scatter a backdated expense into the
 * day somebody happened to type it in.
 */
export const ledgerDateLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Undated';

  const startOfDay = (value: Date): number =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    // The year is only worth the space once it stops being the current one.
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
};

/**
 * Splits an already-ordered list into consecutive day groups.
 *
 * PRESERVES SERVER ORDER. The rows arrive sorted by `expense_date desc, created_at desc`,
 * and this walks them in sequence rather than bucketing into a map and re-sorting. That
 * keeps the ledger's order identical to the server's, including how it breaks ties between
 * two expenses on the same date — something a client-side re-sort would silently change.
 *
 * It also means a page boundary cannot merge two separate runs of the same day, because
 * groups are only ever built from adjacent rows.
 */
export function groupByDay<T>(
  rows: T[],
  dateOf: (row: T) => string,
): { label: string; rows: T[] }[] {
  const groups: { label: string; rows: T[] }[] = [];

  for (const row of rows) {
    const label = ledgerDateLabel(dateOf(row));
    const last = groups[groups.length - 1];

    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }

  return groups;
}
