import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

/**
 * Admin read models.
 *
 * Everything here aggregates in PostgreSQL and is bounded by a page size. An admin
 * console is exactly the surface where an unbounded "select everything" query becomes a
 * production incident, so there is no such code path.
 *
 * Note what this deliberately does NOT provide: any way to act as another user. An
 * administrator can inspect and manage records, but there is no impersonation, no
 * session minting, and no password reveal -- so admin access can never be used to
 * transact as someone else.
 */

/**
 * Raw `db.execute` bypasses Drizzle's column mapping, so timestamp columns arrive as
 * whatever the driver produced -- a Date or an ISO string depending on the type. Casting
 * to Date and calling .toISOString() therefore throws at runtime. Normalising here keeps
 * the lie out of the type system.
 */
const toIso = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export type PlatformStats = {
  users: { total: number; verified: number; admins: number; disabled: number; newLast30Days: number };
  groups: { total: number; active30Days: number; disabled: number };
  expenses: { total: number; totalValuePaise: number; last30Days: number };
  settlements: { total: number; completed: number; pending: number; completedValuePaise: number };
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const result = await db.execute<Record<string, string | number | null>>(sql`
    select
      (select count(*) from users)::int as user_total,
      (select count(*) from users where email_verified_at is not null)::int as user_verified,
      (select count(*) from users where role = 'admin')::int as user_admins,
      (select count(*) from users where status = 'disabled')::int as user_disabled,
      (select count(*) from users where created_at > now() - interval '30 days')::int
        as user_recent,
      (select count(*) from groups)::int as group_total,
      (select count(*) from groups where status = 'disabled')::int as group_disabled,
      (select count(distinct e.group_id) from expenses e
        where e.created_at > now() - interval '30 days')::int as group_active,
      (select count(*) from expenses)::int as expense_total,
      (select coalesce(sum(amount_paise), 0) from expenses)::bigint as expense_value,
      (select count(*) from expenses where created_at > now() - interval '30 days')::int
        as expense_recent,
      (select count(*) from settlements)::int as settlement_total,
      (select count(*) from settlements where status = 'completed')::int as settlement_completed,
      (select count(*) from settlements where status = 'paid_pending_approval')::int
        as settlement_pending,
      (select coalesce(sum(amount_paise), 0) from settlements where status = 'completed')::bigint
        as settlement_value
  `);

  const row = result.rows[0] ?? {};
  const num = (key: string): number => Number(row[key] ?? 0);

  return {
    users: {
      total: num('user_total'),
      verified: num('user_verified'),
      admins: num('user_admins'),
      disabled: num('user_disabled'),
      newLast30Days: num('user_recent'),
    },
    groups: {
      total: num('group_total'),
      active30Days: num('group_active'),
      disabled: num('group_disabled'),
    },
    expenses: {
      total: num('expense_total'),
      totalValuePaise: num('expense_value'),
      last30Days: num('expense_recent'),
    },
    settlements: {
      total: num('settlement_total'),
      completed: num('settlement_completed'),
      pending: num('settlement_pending'),
      completedValuePaise: num('settlement_value'),
    },
  };
};

export type UserFilters = {
  search?: string;
  role?: 'admin' | 'user';
  verified?: boolean;
  /** Account status, as set by disable/enable. */
  status?: 'active' | 'disabled';
  limit: number;
  offset: number;
};

export const listUsers = async (filters: UserFilters) => {
  const conditions = [sql`true`];

  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(sql`(u.full_name ilike ${pattern} or u.email ilike ${pattern})`);
  }
  if (filters.role) conditions.push(sql`u.role = ${filters.role}::user_role`);
  if (filters.status) conditions.push(sql`u.status = ${filters.status}::account_status`);
  if (filters.verified !== undefined) {
    conditions.push(
      filters.verified
        ? sql`u.email_verified_at is not null`
        : sql`u.email_verified_at is null`,
    );
  }

  const where = sql.join(conditions, sql` and `);

  const rows = await db.execute<Record<string, unknown>>(sql`
    select u.id, u.full_name, u.email, u.role, u.upi_id, u.email_verified_at, u.created_at,
           u.status, u.disabled_at, u.disabled_reason,
           (select count(*) from user_permissions up where up.user_id = u.id)::int
             as permission_override_count,
           (select count(*) from group_members gm where gm.user_id = u.id)::int as group_count,
           (select count(*) from expenses e where e.paid_by = u.id)::int as expense_count,
           (select count(*) from sessions s
             where s.user_id = u.id and s.revoked_at is null and s.expires_at > now())::int
             as active_sessions
      from users u
     where ${where}
     order by u.created_at desc
     limit ${filters.limit} offset ${filters.offset}
  `);

  const totalResult = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from users u where ${where}
  `);

  return {
    rows: rows.rows.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      role: String(row.role) as 'admin' | 'user',
      upiId: row.upi_id ? String(row.upi_id) : null,
      isVerified: row.email_verified_at !== null,
      status: String(row.status) as 'active' | 'disabled',
      disabledAt: row.disabled_at ? toIso(row.disabled_at) : null,
      disabledReason: row.disabled_reason ? String(row.disabled_reason) : null,
      permissionOverrideCount: Number(row.permission_override_count ?? 0),
      createdAt: toIso(row.created_at),
      groupCount: Number(row.group_count),
      expenseCount: Number(row.expense_count),
      activeSessions: Number(row.active_sessions),
    })),
    total: totalResult.rows[0]?.count ?? 0,
  };
};

export type GroupFilters = {
  search?: string;
  status?: 'active' | 'disabled';
  limit: number;
  offset: number;
};

export const listGroups = async (filters: GroupFilters) => {
  const conditions = [sql`true`];
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(sql`(g.name ilike ${pattern} or g.invite_code ilike ${pattern})`);
  }
  if (filters.status) conditions.push(sql`g.status = ${filters.status}::account_status`);
  const where = sql.join(conditions, sql` and `);

  const rows = await db.execute<Record<string, unknown>>(sql`
    select g.id, g.name, g.invite_code, g.payday, g.created_at, g.status, g.disabled_at,
           creator.full_name as creator_name, creator.email as creator_email,
           (select count(*) from group_members gm where gm.group_id = g.id)::int as member_count,
           (select count(*) from expenses e where e.group_id = g.id)::int as expense_count,
           (select coalesce(sum(e.amount_paise), 0) from expenses e
             where e.group_id = g.id)::bigint as total_value,
           (select max(e.created_at) from expenses e where e.group_id = g.id) as last_activity
      from groups g
      join users creator on creator.id = g.created_by
     where ${where}
     order by g.created_at desc
     limit ${filters.limit} offset ${filters.offset}
  `);

  const totalResult = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from groups g where ${where}
  `);

  return {
    rows: rows.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      status: String(row.status) as 'active' | 'disabled',
      disabledAt: row.disabled_at ? toIso(row.disabled_at) : null,
      inviteCode: String(row.invite_code),
      payday: row.payday === null ? null : Number(row.payday),
      createdAt: toIso(row.created_at),
      creatorName: String(row.creator_name),
      creatorEmail: String(row.creator_email),
      memberCount: Number(row.member_count),
      expenseCount: Number(row.expense_count),
      totalValuePaise: Number(row.total_value),
      lastActivityAt: toIso(row.last_activity),
    })),
    total: totalResult.rows[0]?.count ?? 0,
  };
};

export type AdminExpenseFilters = {
  search?: string;
  groupId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

export const listExpenses = async (filters: AdminExpenseFilters) => {
  const conditions = [sql`true`];
  if (filters.groupId) conditions.push(sql`e.group_id = ${filters.groupId}`);
  if (filters.from) conditions.push(sql`e.expense_date >= ${filters.from}::date`);
  if (filters.to) conditions.push(sql`e.expense_date <= ${filters.to}::date`);
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(sql`e.title ilike ${pattern}`);
  }
  const where = sql.join(conditions, sql` and `);

  const rows = await db.execute<Record<string, unknown>>(sql`
    select e.id, e.title, e.amount_paise, e.expense_date, e.payment_mode, e.category,
           e.created_at, g.name as group_name, g.id as group_id, u.full_name as payer_name,
           (select count(*) from expense_participants ep where ep.expense_id = e.id)::int
             as participant_count
      from expenses e
      join groups g on g.id = e.group_id
      join users u on u.id = e.paid_by
     where ${where}
     order by e.created_at desc
     limit ${filters.limit} offset ${filters.offset}
  `);

  const totalResult = await db.execute<{ count: number; value: string | number }>(sql`
    select count(*)::int as count, coalesce(sum(e.amount_paise), 0)::bigint as value
      from expenses e where ${where}
  `);

  return {
    rows: rows.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      amountPaise: Number(row.amount_paise),
      expenseDate: String(row.expense_date).slice(0, 10),
      paymentMode: String(row.payment_mode),
      category: row.category ? String(row.category) : null,
      groupId: String(row.group_id),
      groupName: String(row.group_name),
      payerName: String(row.payer_name),
      participantCount: Number(row.participant_count),
      createdAt: toIso(row.created_at),
    })),
    total: totalResult.rows[0]?.count ?? 0,
    totalValuePaise: Number(totalResult.rows[0]?.value ?? 0),
  };
};

/**
 * Platform-wide activity feed.
 *
 * Reads the same `activities` rows the group feed uses, so wording and history rules are
 * preserved exactly -- including migrated entries that carry their original sentence in
 * `metadata.legacyAction`. Nothing is re-derived or reworded here.
 *
 * Metadata is passed through as stored. It describes what happened (titles, amounts) and
 * has never held a credential; the activity writers record domain facts only.
 */
export type ActivityFilters = {
  limit: number;
  offset: number;
  groupId?: string;
  actorId?: string;
  type?: string;
  from?: string;
  to?: string;
  search?: string;
};

export const listActivity = async (filters: ActivityFilters) => {
  const conditions = [sql`true`];

  if (filters.groupId) conditions.push(sql`a.group_id = ${filters.groupId}`);
  if (filters.actorId) conditions.push(sql`a.actor_user_id = ${filters.actorId}`);
  if (filters.type) conditions.push(sql`a.type = ${filters.type}::activity_type`);
  if (filters.from) conditions.push(sql`a.created_at >= ${`${filters.from}T00:00:00.000Z`}`);
  if (filters.to) conditions.push(sql`a.created_at <= ${`${filters.to}T23:59:59.999Z`}`);
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(
      sql`(u.full_name ilike ${pattern} or u.email ilike ${pattern} or g.name ilike ${pattern}
           or a.metadata::text ilike ${pattern})`,
    );
  }

  const where = sql.join(conditions, sql` and `);

  const rows = await db.execute<Record<string, unknown>>(sql`
    select a.id, a.type, a.entity_type, a.entity_id, a.metadata, a.created_at,
           u.id as actor_id, u.full_name as actor_name, u.email as actor_email,
           g.id as group_id, g.name as group_name
      from activities a
      join users u on u.id = a.actor_user_id
      join groups g on g.id = a.group_id
     where ${where}
     order by a.created_at desc
     limit ${filters.limit} offset ${filters.offset}
  `);

  const totalResult = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
      from activities a
      join users u on u.id = a.actor_user_id
      join groups g on g.id = a.group_id
     where ${where}
  `);

  return {
    rows: rows.rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      entityType: row.entity_type ? String(row.entity_type) : null,
      entityId: row.entity_id ? String(row.entity_id) : null,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: toIso(row.created_at),
      actor: {
        id: String(row.actor_id),
        fullName: String(row.actor_name),
        email: String(row.actor_email),
      },
      group: { id: String(row.group_id), name: String(row.group_name) },
    })),
    total: totalResult.rows[0]?.count ?? 0,
  };
};
