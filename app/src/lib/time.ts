/**
 * "5 min ago", for things that happened recently enough that the gap is the useful fact.
 *
 * Beyond a day the clock time is more useful than a count of hours, and the list around it
 * is already grouped by date, so older entries show just the time of day. Uses the phone's
 * local calendar, like `todayIso` and the ledger's date headings.
 */
export const relativeTime = (iso: string, now: number = Date.now()): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'Just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + ' min ago';

  const hours = Math.round(minutes / 60);
  if (hours < 12) return hours + (hours === 1 ? ' hr ago' : ' hrs ago');

  return new Date(then).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
