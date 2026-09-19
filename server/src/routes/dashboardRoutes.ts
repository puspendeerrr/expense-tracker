import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { validateBody, validated } from '../middleware/validate.js';
import * as preferences from '../services/dashboardPreferencesService.js';

/**
 * Mounted at /api/dashboard.
 *
 * Preferences belong to the caller, so no route here names a user. The widget registry
 * is served alongside them: the client needs labels and descriptions to render the
 * customisation UI, and shipping a second copy of that list in the frontend is how the
 * two drift apart.
 */
const router = Router();

const preferencesSchema = z
  .object({
    mode: z.enum(['summary', 'detailed']),
    view: z.enum(['group', 'personal']),
    widgets: z
      .array(
        z.object({ id: z.string().trim().min(1).max(40), visible: z.boolean() }).strict(),
      )
      // Unknown ids are dropped by the service rather than rejected here: a client on an
      // older build should be able to save without its layout being refused outright.
      .max(50),
  })
  .strict();

router.use(asyncHandler(loadSession), requireAuth);

router.get(
  '/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    sendOk(res, {
      preferences: await preferences.getPreferences(req.user!.id),
      registry: preferences.WIDGETS,
    });
  }),
);

router.put(
  '/preferences',
  validateBody(preferencesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = validated(req, preferencesSchema);
    sendOk(res, {
      preferences: await preferences.savePreferences(req.user!.id, input),
      registry: preferences.WIDGETS,
    });
  }),
);

router.delete(
  '/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    sendOk(res, {
      preferences: await preferences.resetPreferences(req.user!.id),
      registry: preferences.WIDGETS,
    });
  }),
);

export default router;
