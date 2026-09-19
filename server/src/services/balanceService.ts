import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

/**
 * Balance engine — the ONLY producer of outstanding obligations in this system.
 *
 * ARCHITECTURAL CONTRACT
 * ----------------------
 * 1. Nothing else -- not the dashboard, not the Excel export, not the members page,
 *    not the settlement controller -- may derive who owes whom. They all call here.
 * 2. Obligations derive from exactly two inputs: frozen expense participant shares,
 *    and settlements whose status is 'completed'. Pending, rejected, cancelled and
 *    will-pay-soon settlements deliberately do not move a balance.
 * 3. Debts are PAIRWISE and DIRECTIONAL. If A owes B and B owes A, both survive
 *    independently; they are never netted into a single figure. Netting would silently
 *    change who owes whom, which this product intentionally refuses to do.
 * 4. Each direction is clamped at zero so an over-settlement cannot invert a debt.
 *    Over-settlement is instead rejected up front -- see `getOutstandingBetween`.
 * 5. Balances are never date-filtered. A debt is a debt regardless of which reporting
 *    window the user happens to be looking at.
 * 6. All arithmetic is integer paise, performed by PostgreSQL.
 */

export type PairwiseDebt = {
  debtorId: string;
  creditorId: string;
  owedPaise: number;
};

type DebtRow = { debtor_id: string; creditor_id: string; owed_paise: string | number };

/**
 * Directional debt for every pair in the group, as two indexed aggregates and a join.
 *
 * Rows that net to zero or below are dropped, so the result contains only live
 * obligations. This is O(expenses + settlements) in the database rather than loading
 * every expense into Node to rebuild an N x N matrix.
 */
export const getPairwiseDebts = async (groupId: string): Promise<PairwiseDebt[]> => {
  const result = await db.execute<DebtRow>(sql`
    with expense_debt as (
      select ep.user_id as debtor_id,
             e.paid_by  as creditor_id,
             sum(ep.share_paise)::bigint as paise
        from expense_participants ep
        join expenses e on e.id = ep.expense_id
       where e.group_id = ${groupId}
         and ep.user_id <> e.paid_by
       group by 1, 2
    ),
    settled as (
      select payer_id    as debtor_id,
             receiver_id as creditor_id,
             sum(amount_paise)::bigint as paise
        from settlements
       where group_id = ${groupId}
         and status = 'completed'
       group by 1, 2
    ),
    pairs as (
      select debtor_id, creditor_id from expense_debt
      union
      select debtor_id, creditor_id from settled
    )
    select p.debtor_id,
           p.creditor_id,
           (coalesce(ed.paise, 0) - coalesce(s.paise, 0))::bigint as owed_paise
      from pairs p
      left join expense_debt ed
             on ed.debtor_id = p.debtor_id and ed.creditor_id = p.creditor_id
      left join settled s
             on s.debtor_id = p.debtor_id and s.creditor_id = p.creditor_id
     where (coalesce(ed.paise, 0) - coalesce(s.paise, 0)) > 0
  `);

  return result.rows.map((row) => ({
    debtorId: row.debtor_id,
    creditorId: row.creditor_id,
    owedPaise: Number(row.owed_paise),
  }));
};

/**
 * Live outstanding amount the payer still owes the receiver, in paise.
 *
 * This is the figure a settlement is validated against. It is returned unclamped-at-the-
 * top but floored at zero, so callers can reject an over-settlement rather than letting
 * the excess silently vanish the way the reference implementation did.
 */
export const getOutstandingBetween = async (
  groupId: string,
  debtorId: string,
  creditorId: string,
): Promise<number> => {
  const result = await db.execute<{ owed_paise: string | number }>(sql`
    select (
      coalesce((
        select sum(ep.share_paise)
          from expense_participants ep
          join expenses e on e.id = ep.expense_id
         where e.group_id = ${groupId}
           and ep.user_id = ${debtorId}
           and e.paid_by  = ${creditorId}
           and ep.user_id <> e.paid_by
      ), 0)
      -
      coalesce((
        select sum(amount_paise)
          from settlements
         where group_id = ${groupId}
           and payer_id = ${debtorId}
           and receiver_id = ${creditorId}
           and status = 'completed'
      ), 0)
    )::bigint as owed_paise
  `);

  return Math.max(0, Number(result.rows[0]?.owed_paise ?? 0));
};

export type UserBalanceEntry = {
  userId: string;
  amountPaise: number;
};

export type UserBalanceSummary = {
  /** People this user still owes money to. */
  youNeedToPay: UserBalanceEntry[];
  youNeedToPayTotalPaise: number;
  /** People who still owe this user money. */
  youWillReceive: UserBalanceEntry[];
  youWillReceiveTotalPaise: number;
  /** Positive when the user is net owed money. Display-only; never settled against. */
  netBalancePaise: number;
};

/** Reduces the group's debt graph to one user's position. */
export const summarizeForUser = (
  debts: PairwiseDebt[],
  userId: string,
): UserBalanceSummary => {
  const youNeedToPay: UserBalanceEntry[] = [];
  const youWillReceive: UserBalanceEntry[] = [];

  for (const debt of debts) {
    if (debt.debtorId === userId) {
      youNeedToPay.push({ userId: debt.creditorId, amountPaise: debt.owedPaise });
    } else if (debt.creditorId === userId) {
      youWillReceive.push({ userId: debt.debtorId, amountPaise: debt.owedPaise });
    }
  }

  youNeedToPay.sort((a, b) => b.amountPaise - a.amountPaise);
  youWillReceive.sort((a, b) => b.amountPaise - a.amountPaise);

  const youNeedToPayTotalPaise = youNeedToPay.reduce((sum, e) => sum + e.amountPaise, 0);
  const youWillReceiveTotalPaise = youWillReceive.reduce((sum, e) => sum + e.amountPaise, 0);

  return {
    youNeedToPay,
    youNeedToPayTotalPaise,
    youWillReceive,
    youWillReceiveTotalPaise,
    netBalancePaise: youWillReceiveTotalPaise - youNeedToPayTotalPaise,
  };
};

/** Convenience wrapper: fetch the graph and reduce it to one user in a single call. */
export const getUserBalanceSummary = async (
  groupId: string,
  userId: string,
): Promise<UserBalanceSummary> => summarizeForUser(await getPairwiseDebts(groupId), userId);

/**
 * True when the user has no live obligations in either direction.
 *
 * The leave-group guard calls this. It is computed server-side from the debt graph and
 * never trusts a client-supplied "balance = 0".
 */
export const hasSettledAllDebts = async (
  groupId: string,
  userId: string,
): Promise<{ settled: boolean; summary: UserBalanceSummary }> => {
  const summary = await getUserBalanceSummary(groupId, userId);
  return {
    settled: summary.youNeedToPayTotalPaise === 0 && summary.youWillReceiveTotalPaise === 0,
    summary,
  };
};

/** Per-member totals for the members page, in one pass over the shared debt graph. */
export const getGroupBalanceTotals = async (
  groupId: string,
): Promise<Map<string, { owesPaise: number; receivesPaise: number }>> => {
  const debts = await getPairwiseDebts(groupId);
  const totals = new Map<string, { owesPaise: number; receivesPaise: number }>();

  const ensure = (id: string) => {
    let entry = totals.get(id);
    if (!entry) {
      entry = { owesPaise: 0, receivesPaise: 0 };
      totals.set(id, entry);
    }
    return entry;
  };

  for (const debt of debts) {
    ensure(debt.debtorId).owesPaise += debt.owedPaise;
    ensure(debt.creditorId).receivesPaise += debt.owedPaise;
  }

  return totals;
};
