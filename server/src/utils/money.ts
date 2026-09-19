/**
 * Money primitives.
 *
 * Paise (integer) is the authoritative representation everywhere in the system.
 * Rupees are a presentation format produced only at the API boundary. Nothing in the
 * domain layer should ever hold a fractional rupee.
 */

/** Largest amount we accept: ₹10,00,00,000. Guards absurd input and overflow. */
export const MAX_AMOUNT_PAISE = 100_000_000_00;

/**
 * Parses a user-supplied rupee amount into exact paise.
 *
 * Rejects anything that is not representable to the paisa, so `10.001` fails loudly
 * rather than being silently rounded into a value the user never agreed to.
 */
export const rupeesToPaise = (value: number | string): number | null => {
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;
  if (!Number.isFinite(numeric)) return null;

  const paise = numeric * 100;
  // Tolerance absorbs binary-float representation error (e.g. 45.075 * 100), while
  // still rejecting genuinely sub-paisa input.
  if (Math.abs(paise - Math.round(paise)) > 1e-6) return null;

  const rounded = Math.round(paise);
  if (!Number.isSafeInteger(rounded)) return null;

  return rounded;
};

/** Paise -> rupees, for presentation only. */
export const paiseToRupees = (paise: number): number => Math.round(paise) / 100;

/** `123456` -> `"₹1,234.56"`, for emails, exports and notification copy. */
export const formatPaise = (paise: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paiseToRupees(paise));

/**
 * Splits an amount across participants with exact reconciliation.
 *
 * Every participant gets the floor share; the remainder is handed out one paisa at a
 * time to the first `remainder` participants. The sum of the result always equals the
 * input exactly -- ₹1000 across 3 people yields 33334 + 33333 + 33333 = 100000 paise,
 * with zero drift regardless of participant count.
 *
 * Callers must pass a stable, deduplicated participant order so that recomputing a
 * split produces the same allocation.
 */
export const distributeShares = (amountPaise: number, participantCount: number): number[] => {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('distributeShares requires a positive integer paise amount');
  }
  if (!Number.isInteger(participantCount) || participantCount <= 0) {
    throw new Error('distributeShares requires at least one participant');
  }

  const base = Math.floor(amountPaise / participantCount);
  const remainder = amountPaise % participantCount;

  return Array.from({ length: participantCount }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
};

/**
 * Splits an amount in proportion to integer weights, with exact reconciliation.
 *
 * Used for percentage splits (weights are basis points) and share splits (weights are
 * the shares themselves). Allocation is the largest-remainder method: everyone gets
 * their floor entitlement, and the leftover paise go to whoever was cut by the most.
 * Ties break on position, so a given input always produces the same allocation.
 *
 * Distributing leftovers by largest remainder rather than "first N get a paisa" matters
 * once weights are unequal: on a 1:1:98 split of ₹10.00, handing the spare paisa to the
 * first participant would over-pay the smallest contributor, which is the one place a
 * user actually notices a single paisa.
 *
 * The sum of the result always equals `amountPaise` exactly.
 */
export const distributeByWeights = (amountPaise: number, weights: number[]): number[] => {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('distributeByWeights requires a positive integer paise amount');
  }
  if (weights.length === 0) {
    throw new Error('distributeByWeights requires at least one weight');
  }
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 0)) {
    throw new Error('distributeByWeights requires non-negative integer weights');
  }

  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) {
    throw new Error('distributeByWeights requires the weights to sum above zero');
  }

  // Numerator stays in integers, so no float ever touches the allocation.
  const allocations = weights.map((weight, index) => {
    const numerator = amountPaise * weight;
    return {
      index,
      base: Math.floor(numerator / totalWeight),
      remainder: numerator % totalWeight,
    };
  });

  let leftover = amountPaise - allocations.reduce((total, row) => total + row.base, 0);

  const byRemainder = [...allocations].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );

  const shares = allocations.map((row) => row.base);
  for (const row of byRemainder) {
    if (leftover <= 0) break;
    shares[row.index] = shares[row.index]! + 1;
    leftover -= 1;
  }

  return shares;
};

/** Sums paise values without any floating-point involvement. */
export const sumPaise = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** 100% expressed in basis points. */
export const TOTAL_BASIS_POINTS = 10_000;

/**
 * Parses a user-supplied percentage into basis points (2 decimal places).
 *
 * Percentages are held as integer basis points for the same reason money is held as
 * paise: `33.33 + 33.33 + 33.34` must be provably 100, and in floating point it is not.
 */
export const percentToBasisPoints = (value: number | string): number | null => {
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0) return null;

  const basisPoints = numeric * 100;
  if (Math.abs(basisPoints - Math.round(basisPoints)) > 1e-6) return null;

  const rounded = Math.round(basisPoints);
  if (!Number.isSafeInteger(rounded) || rounded > TOTAL_BASIS_POINTS) return null;

  return rounded;
};
