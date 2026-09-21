import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { validateBody, validated } from '../middleware/validate.js';
import * as expoPush from '../services/expoPushService.js';
import { logger } from '../utils/logger.js';

/**
 * Native device registration and notification preferences.
 *
 * Mounted at /api/devices. Every route is scoped to `req.user.id`; there is no path or
 * body parameter naming a user anywhere in this file, which is what makes it impossible
 * to register a token against somebody else's account or read their preferences.
 */
const router = Router();

/**
 * An Expo push token, shaped `ExponentPushToken[...]`.
 *
 * Validated by shape rather than accepted as any string, so a client cannot store
 * arbitrary text in a column the server will later post to a third party.
 */
const expoTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^Expo(nent)?PushToken\[[^\]\s]+\]$/, 'Not an Expo push token');

const registerSchema = z
  .object({
    /** Random, generated once per install. Not a hardware identifier. */
    installationId: z.string().trim().min(8).max(128),
    token: expoTokenSchema,
    platform: z.enum(['android', 'ios']),
    deviceName: z.string().trim().max(80).nullable().optional(),
    appVersion: z.string().trim().max(32).nullable().optional(),
  })
  .strict();

const unregisterSchema = z
  .object({ installationId: z.string().trim().min(8).max(128) })
  .strict();

const deviceEnabledSchema = z
  .object({
    installationId: z.string().trim().min(8).max(128),
    enabled: z.boolean(),
  })
  .strict();

const preferencesSchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    financial: z.boolean().optional(),
    settlements: z.boolean().optional(),
    activity: z.boolean().optional(),
    security: z.boolean().optional(),
    general: z.boolean().optional(),
  })
  .strict();

router.use(asyncHandler(loadSession), requireAuth);

/**
 * Registers or refreshes this install.
 *
 * Idempotent, because the app calls it on every launch: keyed on `installationId`, the
 * same phone updates its row instead of adding one. The token is never echoed back and
 * never logged.
 */
router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = validated(req, registerSchema);

    await expoPush.registerDevice({
      userId: req.user!.id,
      installationId: input.installationId,
      token: input.token,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      appVersion: input.appVersion ?? null,
    });

    // The token is deliberately absent from this log line.
    logger.info('device.registered', {
      userId: req.user!.id,
      platform: input.platform,
    });

    sendOk(res, { registered: true }, 201);
  }),
);

/** Forgets this install, so a shared phone stops receiving this account's pushes. */
router.post(
  '/unregister',
  validateBody(unregisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { installationId } = validated(req, unregisterSchema);
    await expoPush.unregisterDevice(req.user!.id, installationId);
    sendOk(res, { unregistered: true });
  }),
);

/** This account's registered phones. Push tokens are never included. */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    sendOk(res, { devices: await expoPush.listDevices(req.user!.id) });
  }),
);

/** The per-device mute switch, distinct from the OS permission. */
router.post(
  '/enabled',
  validateBody(deviceEnabledSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = validated(req, deviceEnabledSchema);
    await expoPush.setDeviceEnabled(req.user!.id, input.installationId, input.enabled);
    sendOk(res, { devices: await expoPush.listDevices(req.user!.id) });
  }),
);

router.get(
  '/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    sendOk(res, { preferences: await expoPush.getPreferences(req.user!.id) });
  }),
);

router.put(
  '/preferences',
  validateBody(preferencesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = validated(req, preferencesSchema);
    sendOk(res, { preferences: await expoPush.savePreferences(req.user!.id, input) });
  }),
);

export default router;
