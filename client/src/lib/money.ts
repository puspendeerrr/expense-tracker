/**
 * Client-side money helpers.
 *
 * Mirrors the server: paise is authoritative, rupees are for display. Nothing here
 * performs arithmetic on rupee floats.
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_COMPACT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** `123456` -> `₹1,234.56` */
export const formatPaise = (paise: number): string => INR.format(paise / 100);

/**
 * Drops the paise for large figures so summary cards stay readable on a 320px screen,
 * where `₹1,24,500.00` would otherwise wrap or clip.
 */
export const formatPaiseCompact = (paise: number): string => {
  const rupees = paise / 100;
  if (Math.abs(rupees) >= 1000) return INR_COMPACT.format(rupees);
  return INR.format(rupees);
};

/** Unsigned display, for rows where direction is conveyed by label or colour. */
export const formatPaiseAbs = (paise: number): string => formatPaise(Math.abs(paise));

/** Parses user input into exact paise, or null when it is not representable. */
export const parseRupeesToPaise = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;

  const paise = numeric * 100;
  if (Math.abs(paise - Math.round(paise)) > 1e-6) return null;

  const rounded = Math.round(paise);
  return Number.isSafeInteger(rounded) ? rounded : null;
};

export const paiseToRupeeString = (paise: number): string => (paise / 100).toFixed(2);
