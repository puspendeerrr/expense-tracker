import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { activities, users, type Activity } from '../db/schema.js';
import { logger } from '../utils/logger.js';

/**
 * Group activity feed.
 *
 * Entries are stored as a type plus JSONB metadata rather than a pre-rendered sentence,
 * so the wording lives in the presentation layer and stays translatable. Rows migrated
 * from the legacy system additionally carry `metadata.legacyAction`: the original
 * sentence, preserved verbatim so no audit detail was lost to the coarser classification.
 */

export type ActivityRow = {
  activity: Activity;
  actor: { id: string; fullName: string; email: string };
};

export type ActivityListFilters = {
  groupId: string;
  limit: number;
  offset: number;
  /** Matches the actor's name or email, or anything in the entry's metadata. */
  search?: string;
  type?: string;
  actorId?: string;
  /** Inclusive YYYY-MM-DD bounds. */
  from?: string;
  to?: string;
};

/**
 * Reads a page of the feed.
 *
 * The same predicate builds both the page and the count, so the total always describes
 * the filtered set rather than the group as a whole -- otherwise "load more" would
 * offer pages that do not exist.
 */
export const listActivities = async (
  options: ActivityListFilters,
): Promise<{ rows: ActivityRow[]; total: number }> => {
  const conditions = [eq(activities.groupId, options.groupId)];

  if (options.actorId) conditions.push(eq(activities.actorUserId, options.actorId));
  if (options.type) {
    conditions.push(sql`${activities.type}::text = ${options.type}`);
  }
  if (options.from) {
    conditions.push(sql`${activities.createdAt} >= ${`${options.from}T00:00:00.000Z`}`);
  }
  if (options.to) {
    conditions.push(sql`${activities.createdAt} <= ${`${options.to}T23:59:59.999Z`}`);
  }
  if (options.search) {
    // Escape the LIKE wildcards so a literal % in a search term matches a literal %.
    const pattern = `%${options.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(
      sql`(${users.fullName} ilike ${pattern} or ${users.email} ilike ${pattern}
           or ${activities.metadata}::text ilike ${pattern})`,
    );
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      activity: activities,
      actor: { id: users.id, fullName: users.fullName, email: users.email },
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.actorUserId))
    .where(where)
    .orderBy(desc(activities.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  const totals = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.actorUserId))
    .where(where);

  return { rows, total: totals[0]?.count ?? 0 };
};

/** Every activity type present in a group, for building the filter control. */
export const listActivityTypes = async (groupId: string): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ type: activities.type })
    .from(activities)
    .where(eq(activities.groupId, groupId));

  return rows.map((row) => String(row.type)).sort();
};

/** Records an entry. Never allowed to fail the operation that triggered it. */
export const recordActivity = async (input: {
  groupId: string;
  actorUserId: string;
  type: Activity['type'];
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  try {
    await db.insert(activities).values({
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error: unknown) {
    // Callers fire this with `void` once the real work has already committed. An
    // unhandled rejection here would take the process down over a history row, so the
    // failure is logged and swallowed -- a missing feed entry is not worth a crash.
    logger.error('activity.record_failed', {
      type: input.type,
      groupId: input.groupId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};
