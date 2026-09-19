import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { adminAudits, users } from '../db/schema.js';
import { logger } from '../utils/logger.js';

/**
 * Administrative audit trail.
 *
 * Every admin mutation records what changed, who changed it and what it was applied to.
 * Writes go through `record`, which accepts an optional transaction so the audit row
 * commits or rolls back with the change it describes -- an audit that can succeed while
 * the change fails (or the reverse) is worse than none, because it is trusted.
 *
 * There is no update or delete path. The table is append-only by construction, not by
 * convention.
 */

/** Action keys, kept in one place so the filter UI and the writers cannot drift apart. */
export const AUDIT_ACTIONS = {
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_DISABLED: 'user.disabled',
  USER_ENABLED: 'user.enabled',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_SESSIONS_REVOKED: 'user.sessions_revoked',
  USER_DELETED: 'user.deleted',
  PERMISSIONS_CHANGED: 'permissions.changed',
  DASHBOARD_SCOPE_CHANGED: 'dashboard_scope.changed',
  DASHBOARD_SCOPE_CLEARED: 'dashboard_scope.cleared',
  GROUP_DISABLED: 'group.disabled',
  GROUP_ENABLED: 'group.enabled',
  GROUP_DELETED: 'group.deleted',
  GROUP_CREATOR_TRANSFERRED: 'group.creator_transferred',
  GROUP_MEMBER_REMOVED: 'group.member_removed',
  EXPENSE_DELETED: 'expense.deleted',
  SETTLEMENT_CANCELLED: 'settlement.cancelled',
  HISTORY_PURGED: 'history.purged',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Keys that must never reach the audit table.
 *
 * An audit log is one of the easiest places to leak a credential by accident: the
 * calling code is already holding the request body and it is tempting to record it
 * wholesale. Stripping here means a careless caller cannot cause a leak.
 */
const FORBIDDEN_METADATA_KEYS = [
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'passwordhash',
  'otp',
  'code',
  'token',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'sessiontoken',
  'invitetoken',
];

/** Recursively removes anything credential-shaped, at any depth. */
export const stripSecrets = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map((item) => stripSecrets(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, '');
    if (FORBIDDEN_METADATA_KEYS.some((forbidden) => normalized.includes(forbidden))) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = stripSecrets(inner, depth + 1);
  }
  return out;
};

export type AuditInput = {
  actorUserId: string;
  actorEmail: string;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
};

type Executor = Pick<typeof db, 'insert'>;

/**
 * Writes one audit row.
 *
 * Pass the transaction when the audited change is itself transactional, so the two
 * commit together. Without one it writes immediately, which suits mutations that are a
 * single statement anyway.
 */
export const record = async (input: AuditInput, tx?: Executor): Promise<void> => {
  const executor = tx ?? db;

  try {
    await executor.insert(adminAudits).values({
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      metadata: (stripSecrets(input.metadata ?? {}) ?? {}) as Record<string, unknown>,
    });
  } catch (error: unknown) {
    // Inside a transaction the caller must see the failure: silently losing the record
    // of a change that did commit is the one outcome this table exists to prevent.
    if (tx) throw error;

    logger.error('audit.record_failed', {
      action: input.action,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

export type AuditFilters = {
  limit: number;
  offset: number;
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
  search?: string;
};

export const list = async (filters: AuditFilters) => {
  const conditions: SQL[] = [];

  if (filters.action) conditions.push(eq(adminAudits.action, filters.action));
  if (filters.actorId) conditions.push(eq(adminAudits.actorUserId, filters.actorId));
  if (filters.targetType) conditions.push(eq(adminAudits.targetType, filters.targetType));
  if (filters.targetId) conditions.push(eq(adminAudits.targetId, filters.targetId));
  if (filters.from) {
    conditions.push(gte(adminAudits.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
  }
  if (filters.to) {
    conditions.push(lte(adminAudits.createdAt, new Date(`${filters.to}T23:59:59.999Z`)));
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const matches = or(
      ilike(adminAudits.actorEmail, pattern),
      ilike(adminAudits.targetLabel, pattern),
      ilike(adminAudits.action, pattern),
    );
    if (matches) conditions.push(matches);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      audit: adminAudits,
      actor: { id: users.id, fullName: users.fullName, email: users.email },
    })
    .from(adminAudits)
    .leftJoin(users, eq(users.id, adminAudits.actorUserId))
    .where(where)
    .orderBy(desc(adminAudits.createdAt))
    .limit(filters.limit)
    .offset(filters.offset);

  const totals = await db.select({ value: count() }).from(adminAudits).where(where);

  return { rows, total: Number(totals[0]?.value ?? 0) };
};

/** Distinct actions present, so the filter offers only what actually exists. */
export const listActions = async (): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ action: adminAudits.action })
    .from(adminAudits)
    .orderBy(adminAudits.action);
  return rows.map((row) => row.action);
};
