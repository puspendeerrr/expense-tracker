export type BillingCycle = {
  payday: number | null;
  startDate: string | null;
  endDate: string | null;
  nextPayday: string | null;
  daysRemaining: number | null;
  isPaydayToday: boolean;
};

const EMPTY: BillingCycle = {
  payday: null,
  startDate: null,
  endDate: null,
  nextPayday: null,
  daysRemaining: null,
  isPaydayToday: false,
};

/** Clamps a target day to the given month's length, so 31 lands on 28/29/30 as needed. */
const clampDayOfMonth = (year: number, month: number, targetDay: number): Date => {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(targetDay, lastDay)));
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Resolves the current billing cycle for a group's payday.
 *
 * Computed in UTC calendar terms against a caller-supplied reference date. The server
 * defines the semantics so the dashboard, the payday banner and the Excel export cannot
 * drift apart the way three independent client-side implementations would.
 */
export const calculateBillingCycle = (
  payday: number | null,
  reference: Date = new Date(),
): BillingCycle => {
  if (payday === null || !Number.isInteger(payday) || payday < 1 || payday > 31) {
    return EMPTY;
  }

  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const day = reference.getUTCDate();

  // On or after this month's payday the cycle runs forward; before it, the cycle
  // started last month.
  const cycleStartsThisMonth = day >= payday;
  const startDate = cycleStartsThisMonth
    ? clampDayOfMonth(year, month, payday)
    : clampDayOfMonth(year, month - 1, payday);
  const nextPayday = cycleStartsThisMonth
    ? clampDayOfMonth(year, month + 1, payday)
    : clampDayOfMonth(year, month, payday);

  const endDate = new Date(nextPayday.getTime() - 24 * 60 * 60 * 1000);

  const today = new Date(Date.UTC(year, month, day));
  const daysRemaining = Math.max(
    0,
    Math.round((nextPayday.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
  );

  return {
    payday,
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
    nextPayday: toIsoDate(nextPayday),
    daysRemaining,
    isPaydayToday: day === Math.min(payday, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
  };
};
