import { getPairwiseDebts, type PairwiseDebt } from './balanceService.js';

/**
 * Settle-up planner — a READ-ONLY suggestion layer over the balance engine.
 *
 * ARCHITECTURAL CONTRACT
 * ----------------------
 * 1. This module writes nothing and is not a second source of truth. It consumes
 *    `getPairwiseDebts` and returns advice; the ledger underneath is untouched.
 * 2. The stored ledger stays PAIRWISE and DIRECTIONAL (see balanceService). Netting
 *    happens only here, only in memory, and only to answer "what is the shortest way
 *    out of this?". Nothing derived here may be written back as a balance.
 * 3. Because the ledger is directional, a suggested transfer is NOT automatically
 *    recordable. If the plan says A pays C but A never actually borrowed from C, the
 *    settlement engine will correctly refuse it. Each transfer therefore reports how
 *    much of it a direct debt actually backs, so the UI can offer one-tap settlement
 *    only where the engine would accept it, and be honest about the rest.
 */

export type NetPosition = {
  userId: string;
  /** Positive: owed money overall. Negative: owes money overall. */
  netPaise: number;
};

export type SuggestedTransfer = {
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
  /**
   * How much of this transfer is covered by a direct debt from `from` to `to`, and so
   * could be recorded through the normal settlement flow right now. Zero means the
   * transfer only makes sense once the money has moved through someone else.
   */
  recordablePaise: number;
};

export type SettlementPlan = {
  /** Live directional debts today -- the number of payments without a plan. */
  currentTransferCount: number;
  /** Payments the plan proposes instead. */
  transfers: SuggestedTransfer[];
  netPositions: NetPosition[];
  /** True when nobody has a net position to resolve. */
  allSettled: boolean;
};

/** Sums each person's directional debts into a single signed position. */
export const computeNetPositions = (debts: PairwiseDebt[]): NetPosition[] => {
  const net = new Map<string, number>();

  for (const debt of debts) {
    net.set(debt.debtorId, (net.get(debt.debtorId) ?? 0) - debt.owedPaise);
    net.set(debt.creditorId, (net.get(debt.creditorId) ?? 0) + debt.owedPaise);
  }

  return [...net.entries()]
    .map(([userId, netPaise]) => ({ userId, netPaise }))
    .filter((position) => position.netPaise !== 0)
    // Stable, amount-then-id ordering so the same ledger always plans identically.
    .sort((a, b) => b.netPaise - a.netPaise || a.userId.localeCompare(b.userId));
};

/**
 * Greedily matches the largest debtor against the largest creditor.
 *
 * This yields at most `n - 1` transfers for `n` people with a non-zero position, which
 * is a large practical improvement over an unplanned ledger. It is deliberately NOT
 * described as minimal: finding the true minimum means partitioning the group into
 * zero-sum subsets, which is NP-hard, and no user is served by paying that cost to
 * occasionally save one transfer.
 */
export const planTransfers = (positions: NetPosition[]): SuggestedTransfer[] => {
  const debtors = positions
    .filter((position) => position.netPaise < 0)
    .map((position) => ({ userId: position.userId, remaining: -position.netPaise }));

  const creditors = positions
    .filter((position) => position.netPaise > 0)
    .map((position) => ({ userId: position.userId, remaining: position.netPaise }));

  const transfers: SuggestedTransfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.remaining - a.remaining || a.userId.localeCompare(b.userId));
    creditors.sort((a, b) => b.remaining - a.remaining || a.userId.localeCompare(b.userId));

    const debtor = debtors[0]!;
    const creditor = creditors[0]!;
    const amountPaise = Math.min(debtor.remaining, creditor.remaining);

    // Guards against a pathological input looping forever; a zero-value transfer is
    // never useful advice anyway.
    if (amountPaise <= 0) break;

    transfers.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amountPaise,
      recordablePaise: 0,
    });

    debtor.remaining -= amountPaise;
    creditor.remaining -= amountPaise;

    if (debtor.remaining === 0) debtors.shift();
    if (creditor.remaining === 0) creditors.shift();
  }

  return transfers;
};

/**
 * Builds the plan for a group.
 *
 * One query. Everything else is arithmetic over the rows the balance engine returned,
 * so the plan can never disagree with the balances it was derived from.
 */
export const getSettlementPlan = async (groupId: string): Promise<SettlementPlan> => {
  const debts = await getPairwiseDebts(groupId);

  const directDebt = new Map<string, number>();
  for (const debt of debts) {
    directDebt.set(`${debt.debtorId}:${debt.creditorId}`, debt.owedPaise);
  }

  const netPositions = computeNetPositions(debts);
  const transfers = planTransfers(netPositions).map((transfer) => ({
    ...transfer,
    recordablePaise: Math.min(
      transfer.amountPaise,
      directDebt.get(`${transfer.fromUserId}:${transfer.toUserId}`) ?? 0,
    ),
  }));

  return {
    currentTransferCount: debts.length,
    transfers,
    netPositions,
    allSettled: netPositions.length === 0,
  };
};
