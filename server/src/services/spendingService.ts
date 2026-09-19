import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { getDashboardScope, type DashboardScope } from './permissionService.js';
import { uuidList } from '../utils/sqlHelpers.js';

/**
 * Person-wise spending dashboard.
 *
 * SCOPE IS THE WHOLE POINT
 * ------------------------
 * This view crosses group boundaries, so every query here is constrained by the scope
 * an administrator attached to the grant. The scope is resolved server-side from the
 * caller's own id -- never from a parameter -- and a grant with no configured scope
 * resolves to nothing rather than everything. A view of other people's money must fail
 * closed.
 *
 * "Spending" here means attribution: what each person's share of the expenses came to.
 * It is deliberately not a balance. Balances are the balance engine's job and are
 * pairwise and directional; conflating the two is how a reporting screen ends up
 * disagreeing with the ledger.
 */

export type SpendingFilters = {
  from?: string;
  to?: string;
  groupId?: string;
};

export type PersonSpending = {
  userId: string;
  fullName: string;
  email: string;
  /** Their share of expenses in scope. */
  spentPaise: number;
  /** What they paid out of pocket, which is a different question. */
  paidPaise: number;
  expenseCount: number;
};

export type SpendingReport = {
  scope: DashboardScope;
  groups: { id: string; name: string }[];
  people: PersonSpending[];
  categories: { category: string | null; spentPaise: number }[];
  months: { month: string; spentPaise: number }[];
  totals: { spentPaise: number; expenseCount: number; groupCount: number; personCount: number };
};

/**
 * Turns the grant into the concrete list of group ids this request may read.
 *
 * Returns null when the caller may see nothing, which callers must treat as an empty
 * report rather than an unfiltered one.
 */
export const resolveVisibleGroupIds = async (
  userId: string,
  requestedGroupId?: string,
): Promise<{ scope: DashboardScope; groupIds: string[] | 'all' } | null> => {
  const scope = await getDashboardScope(userId);

  if (scope.kind === 'none') return null;

  if (scope.kind === 'all_groups') {
    // A requested group still narrows the view, but cannot widen it.
    return { scope, groupIds: requestedGroupId ? [requestedGroupId] : 'all' };
  }

  if (scope.groupIds.length === 0) return null;

  if (requestedGroupId) {
    // Silently ignoring an out-of-scope request would be worse than returning nothing:
    // it would show the person a report they think is filtered when it is not.
    if (!scope.groupIds.includes(requestedGroupId)) return null;
    return { scope, groupIds: [requestedGroupId] };
  }

  return { scope, groupIds: scope.groupIds };
};

const EMPTY: Omit<SpendingReport, 'scope'> = {
  groups: [],
  people: [],
  categories: [],
  months: [],
  totals: { spentPaise: 0, expenseCount: 0, groupCount: 0, personCount: 0 },
};

export const getSpendingReport = async (
  userId: string,
  filters: SpendingFilters,
): Promise<SpendingReport> => {
  const resolved = await resolveVisibleGroupIds(userId, filters.groupId);

  if (!resolved) {
    return { scope: { kind: 'none' }, ...EMPTY };
  }

  const groupFilter =
    resolved.groupIds === 'all'
      ? sql`true`
      : sql`e.group_id in ${uuidList(resolved.groupIds)}`;

  const dateFilter = sql.join(
    [
      filters.from ? sql`e.expense_date >= ${filters.from}` : sql`true`,
      filters.to ? sql`e.expense_date <= ${filters.to}` : sql`true`,
    ],
    sql` and `,
  );

  const where = sql`${groupFilter} and ${dateFilter}`;

  /* ---- Per person ---- */
  const people = await db.execute<{
    user_id: string;
    full_name: string;
    email: string;
    spent_paise: string | number;
    paid_paise: string | number;
    expense_count: number;
  }>(sql`
    with shares as (
      select ep.user_id, sum(ep.share_paise)::bigint as spent, count(distinct e.id)::int as cnt
        from expense_participants ep
        join expenses e on e.id = ep.expense_id
       where ${where}
       group by ep.user_id
    ),
    paid as (
      select e.paid_by as user_id, sum(e.amount_paise)::bigint as paid
        from expenses e
       where ${where}
       group by e.paid_by
    )
    select u.id as user_id, u.full_name, u.email,
           coalesce(s.spent, 0)::bigint as spent_paise,
           coalesce(p.paid, 0)::bigint  as paid_paise,
           coalesce(s.cnt, 0) as expense_count
      from users u
      left join shares s on s.user_id = u.id
      left join paid   p on p.user_id = u.id
     where s.user_id is not null or p.user_id is not null
     order by coalesce(s.spent, 0) desc
  `);

  /* ---- By category ---- */
  const categories = await db.execute<{ category: string | null; spent_paise: string | number }>(sql`
    select e.category, sum(ep.share_paise)::bigint as spent_paise
      from expense_participants ep
      join expenses e on e.id = ep.expense_id
     where ${where}
     group by e.category
     order by spent_paise desc
  `);

  /* ---- By month ---- */
  const months = await db.execute<{ month: string; spent_paise: string | number }>(sql`
    select to_char(date_trunc('month', e.expense_date), 'YYYY-MM') as month,
           sum(ep.share_paise)::bigint as spent_paise
      from expense_participants ep
      join expenses e on e.id = ep.expense_id
     where ${where}
     group by 1
     order by 1
  `);

  /* ---- Groups in scope, for the filter control ---- */
  const groups = await db.execute<{ id: string; name: string }>(
    resolved.groupIds === 'all'
      ? sql`select id, name from groups order by name`
      : sql`select id, name from groups where id in ${uuidList(resolved.groupIds)} order by name`,
  );

  const peopleRows: PersonSpending[] = people.rows.map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    spentPaise: Number(row.spent_paise),
    paidPaise: Number(row.paid_paise),
    expenseCount: Number(row.expense_count),
  }));

  return {
    scope: resolved.scope,
    groups: groups.rows.map((row) => ({ id: row.id, name: row.name })),
    people: peopleRows,
    categories: categories.rows.map((row) => ({
      category: row.category,
      spentPaise: Number(row.spent_paise),
    })),
    months: months.rows.map((row) => ({
      month: row.month,
      spentPaise: Number(row.spent_paise),
    })),
    totals: {
      spentPaise: peopleRows.reduce((total, person) => total + person.spentPaise, 0),
      expenseCount: peopleRows.reduce((total, person) => total + person.expenseCount, 0),
      groupCount: groups.rows.length,
      personCount: peopleRows.length,
    },
  };
};
