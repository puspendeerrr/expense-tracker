import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { validateBody, validateQuery, validated, validatedQuery } from '../middleware/validate.js';
import * as notificationService from '../services/notificationService.js';
import type { Notification } from '../db/schema.js';

/** Mounted at /api/notifications. Every route is scoped to the authenticated user. */
const router = Router();

const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    unreadOnly: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .passthrough();

const markReadSchema = z
  .object({ ids: z.array(z.string().uuid()).min(1).max(100) })
  .strict();

const present = (notification: Notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  entityType: notification.entityType,
  entityId: notification.entityId,
  groupId: notification.groupId,
  isRead: notification.readAt !== null,
  readAt: notification.readAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
});

router.use(asyncHandler(loadSession), requireAuth);

router.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset, unreadOnly } = validatedQuery(req, listQuerySchema);
    const [{ rows, total }, unreadCount] = await Promise.all([
      notificationService.listNotifications(req.user!.id, { limit, offset, unreadOnly }),
      notificationService.getUnreadCount(req.user!.id),
    ]);

    sendOk(res, {
      notifications: rows.map(present),
      unreadCount,
      pagination: { total, limit, offset, hasMore: offset + rows.length < total },
    });
  }),
);

/** Polled by the bell, so it stays deliberately cheap: one indexed COUNT. */
router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    sendOk(res, { unreadCount: await notificationService.getUnreadCount(req.user!.id) });
  }),
);

router.post(
  '/read',
  validateBody(markReadSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { ids } = validated(req, markReadSchema);
    const updated = await notificationService.markRead(req.user!.id, ids);
    sendOk(res, { updated, unreadCount: await notificationService.getUnreadCount(req.user!.id) });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await notificationService.markAllRead(req.user!.id);
    sendOk(res, { updated, unreadCount: 0 });
  }),
);

router.delete(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await notificationService.clearAll(req.user!.id);
    sendOk(res, { cleared: true });
  }),
);

export default router;
