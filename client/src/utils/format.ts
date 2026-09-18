/**
 * Shared presentation-boundary formatting.
 *
 * All money is rounded to 2dp exactly here and nowhere else, so every surface
 * (cards, tables, charts, tooltips) prints the same figure for the same value.
 */

/** ₹1,234.50 — always 2dp, always grouped. */
export const formatMoney = (value: number | null | undefined): string => {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Signed money for net positions: +₹120.00 / -₹80.00 / ₹0.00 */
export const formatSignedMoney = (value: number | null | undefined): string => {
  const n = Number(value) || 0;
  if (n > 0) return `+${formatMoney(n)}`;
  if (n < 0) return `-${formatMoney(Math.abs(n))}`;
  return formatMoney(0);
};

/** Compact money for dense chart axes: ₹1.2k, ₹3.4L */
export const formatMoneyCompact = (value: number | null | undefined): string => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateShort = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

export const formatTimeAgo = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const past = new Date(value);
  if (isNaN(past.getTime())) return '';
  const diffMs = Date.now() - past.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return formatDate(past);
};

/** Colour tokens reused across the dashboard so money always reads the same way. */
export const MONEY_COLORS = {
  positive: '#16a34a',
  negative: '#dc2626',
  neutral: '#0f172a',
  muted: '#64748b',
  brand: '#2563eb',
} as const;

export const netColor = (value: number): string => {
  if (value > 0) return MONEY_COLORS.positive;
  if (value < 0) return MONEY_COLORS.negative;
  return MONEY_COLORS.muted;
};
