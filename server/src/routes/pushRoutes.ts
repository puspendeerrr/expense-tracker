import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { validateBody, validated } from '../middleware/validate.js';
import * as pushService from '../services/pushService.js';

/** Mounted at /api/push. */
const router = Router();

const subscribeSchema = z
  .object({
    endpoint: z.string().url().max(1024),
    keys: z.object({
      p256dh: z.string().min(1).max(512),
      auth: z.string().min(1).max(512),
    }),
  })
  .strict();

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1024) }).strict();

/**
 * The VAPID public key.
 *
 * Unauthenticated on purpose: it is a public identifier, and the client needs it before
 * it can even construct a subscription.
 */
router.get('/public-key', (_req: Request, res: Response) => {
  sendOk(res, {
    publicKey: pushService.getPublicKey(),
    enabled: pushService.isPushConfigured(),
  });
});

router.use(asyncHandler(loadSession), requireAuth);

router.post(
  '/subscribe',
  validateBody(subscribeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = validated(req, subscribeSchema);
    await pushService.saveSubscription({
      userId: req.user!.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
    });
    sendOk(res, { subscribed: true }, 201);
  }),
);

router.post(
  '/unsubscribe',
  validateBody(unsubscribeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { endpoint } = validated(req, unsubscribeSchema);
    await pushService.removeSubscription(req.user!.id, endpoint);
    sendOk(res, { unsubscribed: true });
  }),
);

/** Lets the client tell whether THIS browser is already registered. */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const subscriptions = await pushService.listSubscriptions(req.user!.id);
    sendOk(res, {
      enabled: pushService.isPushConfigured(),
      deviceCount: subscriptions.length,
      endpoints: subscriptions.map((subscription) => subscription.endpoint),
    });
  }),
);

export default router;
