import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

/**
 * Search across everything one account can legitimately see.
 *
 * The whole security model of this file is a single predicate: every query is joined to
 * the caller's group memberships, so nothing outside their groups can be returned. That
 * scope is built once, in `visibleGroups`, and every branch below uses it -- rather than
 * each query remembering to filter, which is the version where one eventually forgets.
 *
 * Deliberately not the admin search with a filter bolted on. The admin one is meant to
 * see everything; starting from it and narrowing would mean a bug in the narrowing is a
 * data leak, whereas here an omission returns too little.
 */

/** Groups this user belongs to. Used as an IN subquery by every branch. */
const visibleGroups = (userId: string) => sql`(
  select gm.group_id from group_members gm where gm.user_id = ${userId}
)`;

/** Escapes LIKE wildcards so a literal % in a search term matches a literal %. */
const likePattern = (term: string): string =>
  `%${term.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;

export type SearchResults = {
  groups: { id: string; name: string; memberCount: number; avatarUrl: string | null }[];
  members: { id: string; fullName: string; email: string; groupId: string; groupName: string }[];
  expenses: {
    id: string;
    title: string;
    amountPaise: number;
    expenseDate: string;
    groupId: string;
    groupName: string;
    payerName: string;
  }[];
  settlements: {
    id: string;
    amountPaise: number;
    status: string;
    groupId: string;
    groupName: string;
    payerName: string;
    receiverName: string | null;
  }[];
  activity: {
    id: string;
    type: string;
    groupId: string;
    groupName: string;
    actorName: string;
    createdAt: string;
  }[];
};

const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value);

/**
 * Runs every branch concurrently.
 *
 * Each is capped independently so one prolific type -- expenses, usually -- cannot crowd
 * the others out of a combined limit and make groups look like they do not match.
 */
export const search = async (
  userId: string,
  term: string,
  limit = 5,
): Promise<SearchResults> => {
  const pattern = likePattern(term);
  const scope = visibleGroups(userId);

  const [groups, members, expenses, settlements, activity] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      select g.id, g.name, g.avatar_url,
             (select count(*) from group_members m where m.group_id = g.id)::int as member_count
        from groups g
       where g.id in ${scope}
         and (g.name ilike ${pattern} or g.invite_code ilike ${pattern})
       order by g.name
       limit ${limit}
    `),

    /*
     * People are found through shared groups, so the row can say which group connects
     * you. DISTINCT ON keeps one row per person rather than one per shared group, which
     * would otherwise fill the results with the same name repeated.
     */
    db.execute<Record<string, unknown>>(sql`
      select distinct on (u.id)
             u.id, u.full_name, u.email, g.id as group_id, g.name as group_name
        from users u
        join group_members gm on gm.user_id = u.id
        join groups g on g.id = gm.group_id
       where gm.group_id in ${scope}
         and u.id <> ${userId}
         and (u.full_name ilike ${pattern} or u.email ilike ${pattern})
       order by u.id, g.name
       limit ${limit}
    `),

    db.execute<Record<string, unknown>>(sql`
      select e.id, e.title, e.amount_paise, e.expense_date,
             g.id as group_id, g.name as group_name, payer.full_name as payer_name
        from expenses e
        join groups g on g.id = e.group_id
        join users payer on payer.id = e.paid_by
       where e.group_id in ${scope}
         and (e.title ilike ${pattern} or e.notes ilike ${pattern})
       order by e.expense_date desc
       limit ${limit}
    `),

    db.execute<Record<string, unknown>>(sql`
      select s.id, s.amount_paise, s.status, g.id as group_id, g.name as group_name,
             payer.full_name as payer_name, receiver.full_name as receiver_name
        from settlements s
        join groups g on g.id = s.group_id
        join users payer on payer.id = s.payer_id
        left join users receiver on receiver.id = s.receiver_id
       where s.group_id in ${scope}
         and (payer.full_name ilike ${pattern}
              or receiver.full_name ilike ${pattern}
              or s.note ilike ${pattern})
       order by s.created_at desc
       limit ${limit}
    `),

    db.execute<Record<string, unknown>>(sql`
      select a.id, a.type, a.created_at, g.id as group_id, g.name as group_name,
             actor.full_name as actor_name
        from activities a
        join groups g on g.id = a.group_id
        join users actor on actor.id = a.actor_user_id
       where a.group_id in ${scope}
         and (actor.full_name ilike ${pattern} or a.metadata::text ilike ${pattern})
       order by a.created_at desc
       limit ${limit}
    `),
  ]);

  return {
    groups: groups.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      memberCount: Number(row.member_count ?? 0),
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    })),
    members: members.rows.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      groupId: String(row.group_id),
      groupName: String(row.group_name),
    })),
    expenses: expenses.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      amountPaise: Number(row.amount_paise),
      expenseDate: String(row.expense_date),
      groupId: String(row.group_id),
      groupName: String(row.group_name),
      payerName: String(row.payer_name),
    })),
    settlements: settlements.rows.map((row) => ({
      id: String(row.id),
      amountPaise: Number(row.amount_paise),
      status: String(row.status),
      groupId: String(row.group_id),
      groupName: String(row.group_name),
      payerName: String(row.payer_name),
      receiverName: row.receiver_name ? String(row.receiver_name) : null,
    })),
    activity: activity.rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      groupId: String(row.group_id),
      groupName: String(row.group_name),
      actorName: String(row.actor_name),
      createdAt: iso(row.created_at),
    })),
  };
};
