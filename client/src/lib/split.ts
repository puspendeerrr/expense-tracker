import type { SplitType } from '@/types/domain';

/**
 * Client-side mirror of the server's split allocator.
 *
 * This exists so the preview in the Add Expense dialog shows the figures that will
 * actually be stored, down to the paisa. It is a convenience, never an authority: the
 * server recomputes every split from scratch and a database trigger refuses any set of
 * shares that does not sum to the total. If the two ever disagree, the server wins and
 * the user sees its error.
 *
 * Kept deliberately in step with `server/src/utils/money.ts`.
 */

export const TOTAL_BASIS_POINTS = 10_000;

/** Largest-remainder allocation. Mirrors `distributeByWeights` on the server. */
export const distributeByWeights = (amountPaise: number, weights: number[]): number[] => {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (amountPaise <= 0 || weights.length === 0 || totalWeight <= 0) {
    return weights.map(() => 0);
  }

  const allocations = weights.map((weight, index) => {
    const numerator = amountPaise * weight;
    return {
      index,
      base: Math.floor(numerator / totalWeight),
      remainder: numerator % totalWeight,
    };
  });

  let leftover = amountPaise - allocations.reduce((total, row) => total + row.base, 0);
  const shares = allocations.map((row) => row.base);

  for (const row of [...allocations].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  )) {
    if (leftover <= 0) break;
    shares[row.index] = shares[row.index]! + 1;
    leftover -= 1;
  }

  return shares;
};

/** Equal split with the remainder going to the first participants. */
export const distributeShares = (amountPaise: number, count: number): number[] => {
  if (amountPaise <= 0 || count <= 0) return Array.from({ length: Math.max(count, 0) }, () => 0);
  const base = Math.floor(amountPaise / count);
  const remainder = amountPaise % count;
  return Array.from({ length: count }, (_, index) => (index < remainder ? base + 1 : base));
};

/** Percentage -> basis points, or null when it carries more precision than 2dp. */
export const parsePercentToBasisPoints = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return null;

  const basisPoints = numeric * 100;
  if (Math.abs(basisPoints - Math.round(basisPoints)) > 1e-6) return null;

  const rounded = Math.round(basisPoints);
  return rounded <= TOTAL_BASIS_POINTS ? rounded : null;
};

/** Whole, non-negative weight for a shares split. */
export const parseShareWeight = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 10_000) return null;
  return numeric;
};

export const isUnequalSplit = (splitType: SplitType): boolean =>
  splitType === 'exact' || splitType === 'percentage' || splitType === 'shares';

export type SplitRow = { userId: string; raw: string };

export type SplitEvaluation = {
  /** Resolved share per participant, in the order given. */
  shares: { userId: string; sharePaise: number }[];
  /** Integer value per participant in the mode's own unit, for submission. */
  values: { userId: string; value: number }[];
  /** How far the entered figures are from what they must total, in the mode's unit. */
  remainder: number;
  /** Human-readable statement of the remaining difference. */
  message: string | null;
  isBalanced: boolean;
  /** True when some row cannot be read at all, so nothing can be previewed. */
  hasInvalidRow: boolean;
};

/**
 * Evaluates the entered rows for an unequal split.
 *
 * Returns both the preview and the payload values, so the dialog never has to derive
 * one from the other and risk them drifting apart.
 */
export const evaluateSplit = (
  splitType: SplitType,
  rows: SplitRow[],
  amountPaise: number | null,
  parseRupees: (value: string) => number | null,
): SplitEvaluation => {
  const parse =
    splitType === 'exact'
      ? parseRupees
      : splitType === 'percentage'
        ? parsePercentToBasisPoints
        : parseShareWeight;

  const parsed = rows.map((row) => ({
    userId: row.userId,
    // An empty box reads as zero, so a user only has to fill in the people involved.
    value: row.raw.trim() === '' ? 0 : parse(row.raw),
  }));

  const hasInvalidRow = parsed.some((row) => row.value === null);
  const values = parsed.map((row) => ({ userId: row.userId, value: row.value ?? 0 }));
  const total = values.reduce((sum, row) => sum + row.value, 0);

  if (hasInvalidRow) {
    return {
      shares: values.map((row) => ({ userId: row.userId, sharePaise: 0 })),
      values,
      remainder: 0,
      message: 'One of the shares is not a valid number.',
      isBalanced: false,
      hasInvalidRow: true,
    };
  }

  if (splitType === 'exact') {
    const target = amountPaise ?? 0;
    const remainder = target - total;
    return {
      shares: values.map((row) => ({ userId: row.userId, sharePaise: row.value })),
      values,
      remainder,
      message:
        remainder === 0
          ? null
          : remainder > 0
            ? `₹${(remainder / 100).toFixed(2)} left to assign`
            : `₹${(Math.abs(remainder) / 100).toFixed(2)} over the total`,
      isBalanced: target > 0 && remainder === 0,
      hasInvalidRow: false,
    };
  }

  if (splitType === 'percentage') {
    const remainder = TOTAL_BASIS_POINTS - total;
    const shares = distributeByWeights(
      amountPaise ?? 0,
      values.map((row) => row.value),
    );
    return {
      shares: values.map((row, index) => ({
        userId: row.userId,
        sharePaise: shares[index] ?? 0,
      })),
      values,
      remainder,
      message:
        remainder === 0
          ? null
          : remainder > 0
            ? `${(remainder / 100).toFixed(2)}% left to assign`
            : `${(Math.abs(remainder) / 100).toFixed(2)}% over 100%`,
      isBalanced: remainder === 0,
      hasInvalidRow: false,
    };
  }

  // Shares: any positive total is valid, so there is nothing to reconcile.
  const shares = distributeByWeights(
    amountPaise ?? 0,
    values.map((row) => row.value),
  );
  return {
    shares: values.map((row, index) => ({
      userId: row.userId,
      sharePaise: shares[index] ?? 0,
    })),
    values,
    remainder: 0,
    message: total === 0 ? 'Give at least one person a share.' : null,
    isBalanced: total > 0,
    hasInvalidRow: false,
  };
};
