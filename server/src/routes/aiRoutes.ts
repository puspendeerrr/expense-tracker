import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { chatMessageSchema } from '../validation/aiSchemas.js';
import { chat } from '../controllers/aiController.js';

/**
 * Mounted at /api/ai.
 *
 * Exposes the conversational SplitWise AI assistant. Strictly gated behind
 * authentication and per-user rate limiting (20 requests / 15 minutes).
 */
const router = Router();

router.post(
  '/chat',
  asyncHandler(loadSession),
  requireAuth,
  rateLimit({
    name: 'ai.chat:user',
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyBy: (req) => req.user?.id,
    message: 'AI request limit reached. You can send up to 20 messages per 15 minutes.',
  }),
  validateBody(chatMessageSchema),
  asyncHandler(chat),
);

export default router;

