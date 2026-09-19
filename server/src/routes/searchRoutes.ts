import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { validateQuery, validatedQuery } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as searchService from '../services/searchService.js';

/**
 * Mounted at /api/search.
 *
 * Results are scoped to the caller's own group memberships inside the service, so there
 * is no group parameter here to get wrong. A minimum term length keeps a single stray
 * keystroke from scanning every table the account can reach.
 */
const router = Router();

const searchQuerySchema = z
  .object({
    q: z.string().trim().min(2, 'Type at least two characters').max(100),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .passthrough();

router.get(
  '/',
  asyncHandler(loadSession),
  requireAuth,
  // Five ILIKE queries per request is cheap individually and worth bounding in bulk.
  rateLimit({ name: 'search:ip', max: 120, windowMs: 60_000 }),
  validateQuery(searchQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = validatedQuery(req, searchQuerySchema);
    sendOk(res, await searchService.search(req.user!.id, q, limit));
  }),
);

export default router;
