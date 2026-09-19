import type { NextFunction, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { groupMembers, groups, type Group, type GroupMember } from '../db/schema.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      group?: Group;
      membership?: GroupMember;
    }
  }
}

/**
 * The single gate for every group-scoped operation.
 *
 * With multi-group membership there is no such thing as an implicit "active group", so
 * the client must name the group it is acting on. That id is untrusted input: this
 * middleware proves the authenticated user actually belongs to it before any handler
 * runs, and attaches the verified group + membership to the request.
 *
 * Handlers must read `req.group.id`, never the raw client value.
 *
 * A non-member gets 404, not 403 -- responding 403 would confirm that a group with that
 * id exists, letting an attacker enumerate groups.
 */
const resolveGroupId = (req: Request): string | undefined => {
  const candidates = [
    (req.params as Record<string, unknown>)?.groupId,
    (req.query as Record<string, unknown>)?.groupId,
    (req.body as Record<string, unknown> | undefined)?.groupId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requireGroupMember = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const groupId = resolveGroupId(req);

    if (!groupId) {
      next(
        new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'A group must be specified.', {
          fields: [{ field: 'groupId', message: 'Group is required' }],
        }),
      );
      return;
    }

    // Reject malformed ids before they reach Postgres, so a bad id is a clean 404
    // rather than a driver-level cast error surfacing as a 500.
    if (!UUID_PATTERN.test(groupId)) {
      next(new AppError(404, ERROR_CODES.NOT_FOUND, 'Group not found.'));
      return;
    }

    const rows = await db
      .select({ group: groups, membership: groupMembers })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, req.user!.id)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      next(new AppError(404, ERROR_CODES.NOT_FOUND, 'Group not found.'));
      return;
    }

    // A disabled group stays fully readable to its members -- their financial history
    // is still theirs to see and export -- but accepts no new writes. Read-only rather
    // than invisible, because making it vanish would look like data loss.
    if (row.group.status === 'disabled' && req.method !== 'GET') {
      next(
        new AppError(
          403,
          ERROR_CODES.GROUP_DISABLED,
          'This group has been disabled by an administrator. It is read-only.',
        ),
      );
      return;
    }

    req.group = row.group;
    req.membership = row.membership;
    next();
  } catch (error: unknown) {
    next(error);
  }
};

/** Layers on top of `requireGroupMember` for creator-only actions. */
export const requireGroupCreator = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.membership?.role !== 'creator') {
    next(
      new AppError(403, ERROR_CODES.FORBIDDEN, 'Only the group creator can do that.'),
    );
    return;
  }
  next();
};
