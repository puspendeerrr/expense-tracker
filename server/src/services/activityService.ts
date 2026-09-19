import { desc, eq, sql } from 'drizzle-orm';
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

export const listActivities = async (options: {
  groupId: string;
  limit: number;
  offset: number;
}): Promise<{ rows: ActivityRow[]; total: number }> => {
  const rows = await db
    .select({
      activity: activities,
      actor: { id: users.id, fullName: users.fullName, email: users.email },
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.actorUserId))
    .where(eq(activities.groupId, options.groupId))
    .orderBy(desc(activities.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  const totals = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .where(eq(activities.groupId, options.groupId));

  return { rows, total: totals[0]?.count ?? 0 };
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
