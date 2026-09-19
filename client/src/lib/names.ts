/**
 * Initials for an avatar fallback.
 *
 * Lives here rather than beside a component because a module that exports both a
 * component and a plain function cannot be Fast Refreshed: React's dev runtime cannot
 * tell whether the non-component export changed behaviour, so it falls back to a full
 * page reload on every edit to that file.
 */
export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
