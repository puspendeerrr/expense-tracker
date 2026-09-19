import { SQL, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { paiseToRupees } from '../utils/money.js';
import { calculateBillingCycle } from '../utils/billingCycle.js';
import {
  getPairwiseDebts,
  summarizeForUser,
  type PairwiseDebt,
} from './balanceService.js';
import { listGroupMembers } from './groupService.js';
import { getAttentionItems } from './settlementService.js';
import type { ReportFilters } from '../validation/reportSchemas.js';
import type { Group, GroupMember } from '../db/schema.js';

/**
 * Reporting service — dashboard analytics and export data.
 *
 * ARCHITECTURAL CONTRACT
 * ----------------------
 * 1. This module NEVER computes outstanding debts. Current dues come exclusively from
 *    `balanceService`, which remains the financial source of truth.
 * 2. Everything derived here is EXPENSE ATTRIBUTION -- historical analytics over frozen
 *    participant shares. That is deliberately not the same thing as an obligation, and
 *    the naming keeps them apart:
 *       "I Paid For Them" / "They Paid For Me"   -> attribution (this module)
 *       "I Currently Owe" / "They Currently Owe" -> obligation  (balance engine)
 * 3. Shares are read from stored rows and never recomputed from the current member list.
 * 4. Balances are never date-filtered. A debt is a debt regardless of the window viewed.
 * 5. Aggregation happens in PostgreSQL. The dashboard never loads thousands of expense
 *    rows into Node to total a card.
 *
 * SCOPES
 * ------
 * The client fetches independent regions so one filter change cannot blank the page:
 *   live      -> balances, dues, attention, members   (never date-filtered)
 *   analytics -> period totals, relationships, recent expenses
 *   chart     -> period breakdown only
 *   full      -> everything, for the export path
 */

/* -------------------------------------------------------------------------- */
/* Filter predicate                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Builds the shared WHERE fragment applied to every aggregate below, so the summary
 * cards, the charts, the relationship table and the workbook can never disagree about
 * which expenses are in scope.
 */
const buildScope = (groupId: string, userId: string, filters: ReportFilters): SQL => {
  const conditions: SQL[] = [sql`e.group_id = ${groupId}`];

  if (filters.from) conditions.push(sql`e.expense_date >= ${filters.from}::date`);
  if (filters.to) conditions.push(sql`e.expense_date <= ${filters.to}::date`);
  if (filters.paymentMode !== 'all') {
    conditions.push(sql`e.payment_mode = ${filters.paymentMode}::payment_mode`);
  }
  if (filters.category) {
    conditions.push(sql`e.category = ${filters.category}::expense_category`);
  }

  // Member filter: the expense must involve that person as payer or beneficiary.
  if (filters.memberId !== 'all') {
    conditions.push(sql`(
      e.paid_by = ${filters.memberId}
      or exists (
        select 1 from expense_participants ep
         where ep.expense_id = e.id and ep.user_id = ${filters.memberId}
      )
    )`);
  }

  const iBenefit = sql`exists (
    select 1 from expense_participants ep
     where ep.expense_id = e.id and ep.user_id = ${userId}
  )`;

  switch (filters.involvement) {
    case 'paid_by_me':
      conditions.push(sql`e.paid_by = ${userId}`);
      break;
    case 'paid_by_others_for_me':
      conditions.push(sql`e.paid_by <> ${userId} and ${iBenefit}`);
      break;
    case 'involving_me':
      conditions.push(sql`(e.paid_by = ${userId} or ${iBenefit})`);
      break;
    default:
      break;
  }

  return sql.join(conditions, sql` and `);
};

/* -------------------------------------------------------------------------- */
/* Period grouping                                                            */
/* -------------------------------------------------------------------------- */

type Grouping = 'day' | 'week' | 'month';

/**
 * Picks a bucket size from the span actually covered, so a year-long range does not
 * render 365 unreadable columns.
 */
const resolveGrouping = async (
  groupId: string,
  userId: string,
  filters: ReportFilters,
): Promise<Grouping> => {
  if (filters.groupBy !== 'auto') return filters.groupBy;

  const scope = buildScope(groupId, userId, filters);
  const result = await db.execute<{ span_days: number | null }>(sql`
    select (max(e.expense_date) - min(e.expense_date)) as span_days
      from expenses e
     where ${scope}
  `);

  const span = Number(result.rows[0]?.span_days ?? 0);
  if (span <= 62) return 'day';
  if (span <= 366) return 'week';
  return 'month';
};

/* -------------------------------------------------------------------------- */
/* Aggregates                                                                 */
/* -------------------------------------------------------------------------- */

export type PeriodSummary = {
  totalExpensePaise: number;
  totalPaidByMePaise: number;
  mySharePaise: number;
  paidForOthersPaise: number;
  paidByOthersForMePaise: number;
  expenseCount: number;
  averageExpensePaise: number;
  largestExpense: { id: string; title: string; amountPaise: number; expenseDate: string } | null;
};

/**
 * Period totals in one query.
 *
 * Each figure answers a different question and they must not be conflated:
 *   totalPaidByMe      -- money that left my pocket as bill payer
 *   myShare            -- the cost allocated to me
 *   paidForOthers      -- I paid, someone else consumed
 *   paidByOthersForMe  -- someone else paid, I consumed
 */
const getPeriodSummary = async (
  groupId: string,
  userId: string,
  filters: ReportFilters,
): Promise<PeriodSummary> => {
  const scope = buildScope(groupId, userId, filters);

  const result = await db.execute<Record<string, string | number | null>>(sql`
    with scoped as (
      select e.* from expenses e where ${scope}
    )
    select
      coalesce(sum(s.amount_paise), 0)::bigint as total_expense_paise,
      coalesce(sum(s.amount_paise) filter (where s.paid_by = ${userId}), 0)::bigint
        as total_paid_by_me_paise,
      count(*)::int as expense_count,
      coalesce((
        select sum(ep.share_paise) from expense_participants ep
          join scoped s2 on s2.id = ep.expense_id
         where ep.user_id = ${userId}
      ), 0)::bigint as my_share_paise,
      coalesce((
        select sum(ep.share_paise) from expense_participants ep
          join scoped s3 on s3.id = ep.expense_id
         where s3.paid_by = ${userId} and ep.user_id <> ${userId}
      ), 0)::bigint as paid_for_others_paise,
      coalesce((
        select sum(ep.share_paise) from expense_participants ep
          join scoped s4 on s4.id = ep.expense_id
         where s4.paid_by <> ${userId} and ep.user_id = ${userId}
      ), 0)::bigint as paid_by_others_for_me_paise
    from scoped s
  `);

  const row = result.rows[0] ?? {};
  const num = (key: string) => Number(row[key] ?? 0);

  const largest = await db.execute<{
    id: string;
    title: string;
    amount_paise: string | number;
    expense_date: string;
  }>(sql`
    select e.id, e.title, e.amount_paise, e.expense_date
      from expenses e
     where ${scope}
     order by e.amount_paise desc, e.expense_date desc
     limit 1
  `);

  const largestRow = largest.rows[0];
  const expenseCount = num('expense_count');
  const totalExpensePaise = num('total_expense_paise');

  return {
    totalExpensePaise,
    totalPaidByMePaise: num('total_paid_by_me_paise'),
    mySharePaise: num('my_share_paise'),
    paidForOthersPaise: num('paid_for_others_paise'),
    paidByOthersForMePaise: num('paid_by_others_for_me_paise'),
    expenseCount,
    averageExpensePaise: expenseCount > 0 ? Math.round(totalExpensePaise / expenseCount) : 0,
    largestExpense: largestRow
      ? {
          id: largestRow.id,
          title: largestRow.title,
          amountPaise: Number(largestRow.amount_paise),
          expenseDate: String(largestRow.expense_date).slice(0, 10),
        }
      : null,
  };
};

export type PeriodBucket = {
  key: string;
  label: string;
  expenseCount: number;
  totalExpensePaise: number;
  paidByMePaise: number;
  mySharePaise: number;
};

/** Time series, bucketed by PostgreSQL. No timezone maths: these are calendar dates. */
const getPeriodBreakdown = async (
  groupId: string,
  userId: string,
  filters: ReportFilters,
  grouping: Grouping,
): Promise<PeriodBucket[]> => {
  const scope = buildScope(groupId, userId, filters);
  const truncUnit = sql.raw(`'${grouping}'`);

  /**
   * The viewer's own share is joined in rather than fetched by a correlated subquery:
   * `expense_participants` has UNIQUE(expense_id, user_id), so the LEFT JOIN adds at
   * most one row per expense and cannot inflate the other aggregates.
   */
  const result = await db.execute<Record<string, string | number>>(sql`
    with scoped as (
      select e.* from expenses e where ${scope}
    ),
    my_shares as (
      select ep.expense_id, ep.share_paise
        from expense_participants ep
       where ep.user_id = ${userId}
    )
    select
      to_char(date_trunc(${truncUnit}, s.expense_date), 'YYYY-MM-DD') as bucket_key,
      count(*)::int as expense_count,
      coalesce(sum(s.amount_paise), 0)::bigint as total_expense_paise,
      coalesce(sum(s.amount_paise) filter (where s.paid_by = ${userId}), 0)::bigint
        as paid_by_me_paise,
      coalesce(sum(ms.share_paise), 0)::bigint as my_share_paise
      from scoped s
      left join my_shares ms on ms.expense_id = s.id
     group by date_trunc(${truncUnit}, s.expense_date)
     order by date_trunc(${truncUnit}, s.expense_date) asc
  `);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return result.rows.map((row) => {
    const key = String(row.bucket_key);
    const [year, month, day] = key.split('-').map(Number);
    const monthLabel = MONTHS[(month ?? 1) - 1] ?? '';
    const label =
      grouping === 'month' ? `${monthLabel} ${year}` : `${day} ${monthLabel}`;

    return {
      key,
      label,
      expenseCount: Number(row.expense_count),
      totalExpensePaise: Number(row.total_expense_paise),
      paidByMePaise: Number(row.paid_by_me_paise),
      mySharePaise: Number(row.my_share_paise),
    };
  });
};

export type AttributionRow = {
  personId: string;
  iPaidForThemPaise: number;
  theyPaidForMePaise: number;
  relatedExpenseCount: number;
  lastRelatedExpenseDate: string | null;
};

/**
 * Per-counterpart historical attribution, aggregated in SQL.
 *
 * This is NOT who owes whom. "I paid ₹2000 for Rahul" does not mean Rahul currently owes
 * ₹2000 -- he may have settled. Current obligations come from the balance engine and are
 * merged in by the caller.
 */
const getAttribution = async (
  groupId: string,
  userId: string,
  filters: ReportFilters,
): Promise<Map<string, AttributionRow>> => {
  const scope = buildScope(groupId, userId, filters);

  const result = await db.execute<Record<string, string | number | null>>(sql`
    with scoped as (
      select e.* from expenses e where ${scope}
    ),
    i_paid_for_them as (
      select ep.user_id as person_id, sum(ep.share_paise)::bigint as paise
        from expense_participants ep
        join scoped s on s.id = ep.expense_id
       where s.paid_by = ${userId} and ep.user_id <> ${userId}
       group by 1
    ),
    they_paid_for_me as (
      select s.paid_by as person_id, sum(ep.share_paise)::bigint as paise
        from expense_participants ep
        join scoped s on s.id = ep.expense_id
       where s.paid_by <> ${userId} and ep.user_id = ${userId}
       group by 1
    ),
    -- Expenses where I am involved, paired with everyone else who is involved.
    related as (
      select other.person_id, count(distinct s.id)::int as expense_count,
             max(s.expense_date) as last_date
        from scoped s
        cross join lateral (
          select ep.user_id as person_id from expense_participants ep
           where ep.expense_id = s.id
          union
          select s.paid_by
        ) other
       where other.person_id <> ${userId}
         and (
           s.paid_by = ${userId}
           or exists (
             select 1 from expense_participants ep2
              where ep2.expense_id = s.id and ep2.user_id = ${userId}
           )
         )
       group by 1
    ),
    people as (
      select person_id from i_paid_for_them
      union select person_id from they_paid_for_me
      union select person_id from related
    )
    select p.person_id,
           coalesce(a.paise, 0)::bigint as i_paid_for_them_paise,
           coalesce(b.paise, 0)::bigint as they_paid_for_me_paise,
           coalesce(r.expense_count, 0)::int as related_expense_count,
           to_char(r.last_date, 'YYYY-MM-DD') as last_related_expense_date
      from people p
      left join i_paid_for_them a on a.person_id = p.person_id
      left join they_paid_for_me b on b.person_id = p.person_id
      left join related r on r.person_id = p.person_id
  `);

  const map = new Map<string, AttributionRow>();
  for (const row of result.rows) {
    const personId = String(row.person_id);
    map.set(personId, {
      personId,
      iPaidForThemPaise: Number(row.i_paid_for_them_paise ?? 0),
      theyPaidForMePaise: Number(row.they_paid_for_me_paise ?? 0),
      relatedExpenseCount: Number(row.related_expense_count ?? 0),
      lastRelatedExpenseDate: row.last_related_expense_date
        ? String(row.last_related_expense_date)
        : null,
    });
  }
  return map;
};

/** Recent expenses within the filtered scope, with the viewer's own share resolved. */
const getRecentExpenses = async (
  groupId: string,
  userId: string,
  filters: ReportFilters,
  limit = 8,
) => {
  const scope = buildScope(groupId, userId, filters);

  const result = await db.execute<Record<string, string | number | null>>(sql`
    select e.id, e.title, e.amount_paise, e.expense_date, e.payment_mode, e.split_type,
           e.category, e.receipt_url, e.notes, e.paid_by,
           u.full_name as payer_name,
           (select count(*) from expense_participants ep where ep.expense_id = e.id)::int
             as participant_count,
           coalesce((
             select ep.share_paise from expense_participants ep
              where ep.expense_id = e.id and ep.user_id = ${userId}
           ), 0)::bigint as my_share_paise,
           exists (
             select 1 from expense_participants ep
              where ep.expense_id = e.id and ep.user_id = ${userId}
           ) as i_benefit
      from expenses e
      join users u on u.id = e.paid_by
     where ${scope}
     order by e.expense_date desc, e.created_at desc
     limit ${limit}
  `);

  return result.rows.map((row) => {
    const paidBy = String(row.paid_by);
    return {
      id: String(row.id),
      title: String(row.title),
      amountPaise: Number(row.amount_paise),
      amount: paiseToRupees(Number(row.amount_paise)),
      expenseDate: String(row.expense_date).slice(0, 10),
      paymentMode: row.payment_mode,
      splitType: row.split_type,
      category: row.category,
      notes: row.notes ?? '',
      hasReceipt: Boolean(row.receipt_url),
      paidBy,
      payerName: String(row.payer_name),
      participantCount: Number(row.participant_count),
      mySharePaise: Number(row.my_share_paise),
      myShare: paiseToRupees(Number(row.my_share_paise)),
      involvement:
        paidBy === userId ? 'paid_by_me' : row.i_benefit ? 'paid_by_others_for_me' : 'not_involved',
    };
  });
};

/* -------------------------------------------------------------------------- */
/* Report assembly                                                            */
/* -------------------------------------------------------------------------- */

const withRupees = (paise: number) => ({ paise, rupees: paiseToRupees(paise) });

export type ReportContext = {
  group: Group;
  membership: GroupMember;
  userId: string;
  filters: ReportFilters;
};

/**
 * LIVE region — current financial position. Deliberately ignores every date filter:
 * changing the reporting window must not appear to change what someone owes.
 */
export const buildLiveRegion = async (ctx: ReportContext) => {
  const { group, userId } = ctx;

  const [debts, members, attention] = await Promise.all([
    getPairwiseDebts(group.id),
    listGroupMembers(group.id),
    getAttentionItems(group.id, userId),
  ]);

  const summary = summarizeForUser(debts, userId);

  const directory = new Map(
    members.map((row) => [
      row.user.id,
      {
        id: row.user.id,
        fullName: row.user.fullName,
        email: row.user.email,
        upiId: row.user.upiId ?? null,
        qrCodeUrl: row.user.qrCodeUrl ?? null,
        role: row.membership.role,
      },
    ]),
  );

  const present = (entries: { userId: string; amountPaise: number }[]) =>
    entries.map((entry) => ({
      user: directory.get(entry.userId) ?? {
        id: entry.userId,
        fullName: 'Former member',
        email: '',
        upiId: null,
        qrCodeUrl: null,
        role: 'member' as const,
      },
      amountPaise: entry.amountPaise,
      amount: paiseToRupees(entry.amountPaise),
    }));

  return {
    group: {
      id: group.id,
      name: group.name,
      currency: group.currency,
      payday: group.payday,
      role: ctx.membership.role,
    },
    billingCycle: calculateBillingCycle(group.payday),
    balances: {
      youNeedToPayTotal: withRupees(summary.youNeedToPayTotalPaise),
      youWillReceiveTotal: withRupees(summary.youWillReceiveTotalPaise),
      netBalance: withRupees(summary.netBalancePaise),
      peopleIOweCount: summary.youNeedToPay.length,
      peopleWhoOweMeCount: summary.youWillReceive.length,
    },
    peopleIOwe: present(summary.youNeedToPay),
    peopleWhoOweMe: present(summary.youWillReceive),
    members: [...directory.values()],
    attention: {
      awaitingMyApprovalCount: attention.awaitingMyApproval.length,
      awaitingTheirApprovalCount: attention.awaitingTheirApproval.length,
      rejectedNeedingActionCount: attention.rejectedNeedingAction.length,
      myPromisesCount: attention.myPromises.length,
      promisesToMeCount: attention.promisesToMe.length,
      totalActionable:
        attention.awaitingMyApproval.length + attention.rejectedNeedingAction.length,
    },
    debts,
  };
};

/** ANALYTICS region — period attribution. Never produces an obligation. */
export const buildAnalyticsRegion = async (ctx: ReportContext) => {
  const { group, userId, filters } = ctx;

  const [summary, attribution, recentExpenses, members] = await Promise.all([
    getPeriodSummary(group.id, userId, filters),
    getAttribution(group.id, userId, filters),
    getRecentExpenses(group.id, userId, filters),
    listGroupMembers(group.id),
  ]);

  const directory = new Map(members.map((row) => [row.user.id, row]));

  const relationships = [...attribution.values()]
    .filter((row) => filters.memberId === 'all' || row.personId === filters.memberId)
    .map((row) => {
      const found = directory.get(row.personId);
      return {
        person: {
          id: row.personId,
          fullName: found?.user.fullName ?? 'Former member',
          email: found?.user.email ?? '',
          upiId: found?.user.upiId ?? null,
          qrCodeUrl: found?.user.qrCodeUrl ?? null,
        },
        isStillMember: Boolean(found),
        iPaidForThem: withRupees(row.iPaidForThemPaise),
        theyPaidForMe: withRupees(row.theyPaidForMePaise),
        relatedExpenseCount: row.relatedExpenseCount,
        lastRelatedExpenseDate: row.lastRelatedExpenseDate,
      };
    })
    .sort(
      (a, b) =>
        b.iPaidForThem.paise + b.theyPaidForMe.paise -
        (a.iPaidForThem.paise + a.theyPaidForMe.paise),
    );

  const topPeopleIPaidFor = relationships
    .filter((r) => r.iPaidForThem.paise > 0)
    .slice(0, 5)
    .map((r) => ({ person: r.person.fullName, ...r.iPaidForThem }));

  const topPeopleWhoPaidForMe = [...relationships]
    .filter((r) => r.theyPaidForMe.paise > 0)
    .sort((a, b) => b.theyPaidForMe.paise - a.theyPaidForMe.paise)
    .slice(0, 5)
    .map((r) => ({ person: r.person.fullName, ...r.theyPaidForMe }));

  return {
    periodSummary: {
      totalExpense: withRupees(summary.totalExpensePaise),
      totalPaidByMe: withRupees(summary.totalPaidByMePaise),
      myShare: withRupees(summary.mySharePaise),
      paidForOthers: withRupees(summary.paidForOthersPaise),
      paidByOthersForMe: withRupees(summary.paidByOthersForMePaise),
      averageExpense: withRupees(summary.averageExpensePaise),
      expenseCount: summary.expenseCount,
      largestExpense: summary.largestExpense,
    },
    relationships,
    topPeopleIPaidFor,
    topPeopleWhoPaidForMe,
    recentExpenses,
  };
};

/** CHART region — the time series alone, so changing the range refetches nothing else. */
export const buildChartRegion = async (ctx: ReportContext) => {
  const grouping = await resolveGrouping(ctx.group.id, ctx.userId, ctx.filters);
  const periodBreakdown = await getPeriodBreakdown(
    ctx.group.id,
    ctx.userId,
    ctx.filters,
    grouping,
  );

  return {
    grouping,
    periodBreakdown: periodBreakdown.map((bucket) => ({
      ...bucket,
      totalExpense: paiseToRupees(bucket.totalExpensePaise),
      paidByMe: paiseToRupees(bucket.paidByMePaise),
      myShare: paiseToRupees(bucket.mySharePaise),
    })),
  };
};

/**
 * Merges live obligations into the attribution rows.
 *
 * This is where the two halves meet, and the only place it happens: attribution supplies
 * "I paid for them", the balance engine supplies "they currently owe me", and they stay
 * distinct fields rather than being blended into one number.
 */
export const mergeRelationships = (
  relationships: Awaited<ReturnType<typeof buildAnalyticsRegion>>['relationships'],
  debts: PairwiseDebt[],
  userId: string,
) => {
  const iOwe = new Map<string, number>();
  const theyOwe = new Map<string, number>();

  for (const debt of debts) {
    if (debt.debtorId === userId) iOwe.set(debt.creditorId, debt.owedPaise);
    else if (debt.creditorId === userId) theyOwe.set(debt.debtorId, debt.owedPaise);
  }

  const known = new Set(relationships.map((r) => r.person.id));
  const merged = relationships.map((row) => ({
    ...row,
    iCurrentlyOwe: withRupees(iOwe.get(row.person.id) ?? 0),
    theyCurrentlyOwe: withRupees(theyOwe.get(row.person.id) ?? 0),
  }));

  // Someone with a live debt but no in-window activity must still appear.
  for (const personId of new Set([...iOwe.keys(), ...theyOwe.keys()])) {
    if (known.has(personId)) continue;
    merged.push({
      person: { id: personId, fullName: 'Former member', email: '', upiId: null, qrCodeUrl: null },
      isStillMember: false,
      iPaidForThem: withRupees(0),
      theyPaidForMe: withRupees(0),
      relatedExpenseCount: 0,
      lastRelatedExpenseDate: null,
      iCurrentlyOwe: withRupees(iOwe.get(personId) ?? 0),
      theyCurrentlyOwe: withRupees(theyOwe.get(personId) ?? 0),
    });
  }

  return merged.sort((a, b) => {
    const aLive = a.iCurrentlyOwe.paise + a.theyCurrentlyOwe.paise;
    const bLive = b.iCurrentlyOwe.paise + b.theyCurrentlyOwe.paise;
    if (aLive !== bLive) return bLive - aLive;
    return (
      b.iPaidForThem.paise + b.theyPaidForMe.paise -
      (a.iPaidForThem.paise + a.theyPaidForMe.paise)
    );
  });
};

/** FULL report, used by the export path and any client wanting one round trip. */
export const buildFullReport = async (ctx: ReportContext) => {
  const [live, analytics, chart] = await Promise.all([
    buildLiveRegion(ctx),
    buildAnalyticsRegion(ctx),
    buildChartRegion(ctx),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      from: ctx.filters.from ?? null,
      to: ctx.filters.to ?? null,
      memberId: ctx.filters.memberId,
      memberName:
        ctx.filters.memberId === 'all'
          ? 'All members'
          : (live.members.find((m) => m.id === ctx.filters.memberId)?.fullName ??
            'Unknown member'),
      paymentMode: ctx.filters.paymentMode,
      involvement: ctx.filters.involvement,
      category: ctx.filters.category ?? null,
      rangeLabel: ctx.filters.rangeLabel ?? 'All time',
      grouping: chart.grouping,
    },
    ...live,
    ...analytics,
    ...chart,
    relationships: mergeRelationships(analytics.relationships, live.debts, ctx.userId),
  };
};

export type FullReport = Awaited<ReturnType<typeof buildFullReport>>;

/* -------------------------------------------------------------------------- */
/* Export dataset                                                             */
/* -------------------------------------------------------------------------- */

export type ExportExpenseRow = {
  id: string;
  title: string;
  amountPaise: number;
  expenseDate: string;
  paidById: string;
  payerName: string;
  paymentMode: string;
  splitType: string;
  category: string | null;
  notes: string;
  hasReceipt: boolean;
  participantCount: number;
  mySharePaise: number;
  involvement: string;
  participants: { userId: string; fullName: string; sharePaise: number; isPayer: boolean }[];
};

/**
 * The complete, untruncated filtered expense list with every participant share.
 *
 * Uses exactly the same `buildScope` predicate as the dashboard aggregates, which is
 * what guarantees the workbook and the screen can never disagree about what is in scope.
 */
export const getExportExpenses = async (
  groupId: string,
  userId: string,
  filters: ReportFilters,
): Promise<ExportExpenseRow[]> => {
  const scope = buildScope(groupId, userId, filters);

  const result = await db.execute<Record<string, unknown>>(sql`
    select e.id, e.title, e.amount_paise, e.expense_date, e.payment_mode, e.split_type,
           e.category, e.notes, e.receipt_url, e.paid_by,
           payer.full_name as payer_name,
           coalesce((
             select json_agg(json_build_object(
                      'userId', ep.user_id,
                      'fullName', pu.full_name,
                      'sharePaise', ep.share_paise
                    ) order by pu.full_name)
               from expense_participants ep
               join users pu on pu.id = ep.user_id
              where ep.expense_id = e.id
           ), '[]'::json) as participants
      from expenses e
      join users payer on payer.id = e.paid_by
     where ${scope}
     order by e.expense_date desc, e.created_at desc
  `);

  return result.rows.map((row) => {
    const participants = (row.participants as { userId: string; fullName: string; sharePaise: string | number }[])
      .map((p) => ({
        userId: p.userId,
        fullName: p.fullName,
        sharePaise: Number(p.sharePaise),
        isPayer: p.userId === String(row.paid_by),
      }));

    const mine = participants.find((p) => p.userId === userId);
    const paidBy = String(row.paid_by);

    return {
      id: String(row.id),
      title: String(row.title),
      amountPaise: Number(row.amount_paise),
      expenseDate: String(row.expense_date).slice(0, 10),
      paidById: paidBy,
      payerName: String(row.payer_name),
      paymentMode: String(row.payment_mode),
      splitType: String(row.split_type),
      category: row.category ? String(row.category) : null,
      notes: String(row.notes ?? ''),
      hasReceipt: Boolean(row.receipt_url),
      participantCount: participants.length,
      mySharePaise: mine?.sharePaise ?? 0,
      involvement:
        paidBy === userId ? 'paid_by_me' : mine ? 'paid_by_others_for_me' : 'not_involved',
      participants,
    };
  });
};

/** Full settlement history within the window, for the workbook's settlements sheet. */
export const getExportSettlements = async (groupId: string, filters: ReportFilters) => {
  const conditions = [sql`s.group_id = ${groupId}`];
  if (filters.from) conditions.push(sql`s.created_at >= ${filters.from}::date`);
  // `to` is inclusive of the whole day, so compare against the following midnight.
  if (filters.to) conditions.push(sql`s.created_at < (${filters.to}::date + interval '1 day')`);

  const result = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.amount_paise, s.status, s.payment_method, s.rejection_reason, s.note,
           s.paid_at, s.verified_at, s.created_at,
           payer.full_name as payer_name, receiver.full_name as receiver_name,
           (s.proof_url is not null) as has_proof
      from settlements s
      join users payer on payer.id = s.payer_id
      join users receiver on receiver.id = s.receiver_id
     where ${sql.join(conditions, sql` and `)}
     order by s.created_at desc
  `);

  return result.rows.map((row) => ({
    id: String(row.id),
    amountPaise: Number(row.amount_paise),
    status: String(row.status),
    paymentMethod: String(row.payment_method),
    rejectionReason: String(row.rejection_reason ?? ''),
    note: String(row.note ?? ''),
    payerName: String(row.payer_name),
    receiverName: String(row.receiver_name),
    hasProof: Boolean(row.has_proof),
    paidAt: row.paid_at as Date,
    verifiedAt: (row.verified_at as Date | null) ?? null,
    createdAt: row.created_at as Date,
  }));
};

export type ExportDataset = {
  report: FullReport;
  expenses: ExportExpenseRow[];
  settlements: Awaited<ReturnType<typeof getExportSettlements>>;
};

export const buildExportDataset = async (ctx: ReportContext): Promise<ExportDataset> => {
  const [report, expenses, settlements] = await Promise.all([
    buildFullReport(ctx),
    getExportExpenses(ctx.group.id, ctx.userId, ctx.filters),
    getExportSettlements(ctx.group.id, ctx.filters),
  ]);
  return { report, expenses, settlements };
};
