/**
 * Wording for the admin console. Figures come from the server as they are; this only
 * turns codes and timestamps into words.
 */

/** "12 Mar 2026", in the phone's locale. Empty for a missing or unreadable date. */
export const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "12 Mar 2026, 4:05 pm". */
export const shortDateTime = (iso: string | null | undefined): string => {
  const day = shortDate(iso);
  if (!day || !iso) return day;
  return day + ', ' + new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

/**
 * "user.role_changed" -> "User role changed".
 *
 * Audit actions are open-ended strings on the server, so this is a readable rendering of
 * whatever arrives, not a list that could fall out of date.
 */
export const auditActionLabel = (action: string): string => {
  const words = action.replace(/[._-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action;
};

export const plural = (count: number, one: string, many: string = one + 's'): string =>
  count.toLocaleString() + ' ' + (count === 1 ? one : many);
