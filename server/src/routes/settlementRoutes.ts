import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireGroupMember } from '../middleware/requireGroupMember.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  approveSettlement,
  cancelSettlement,
  createSettlement,
  getAttention,
  getOutstanding,
  getSettlementPlan,
  listSettlements,
  rejectSettlement,
  reuploadProof,
} from '../controllers/settlementController.js';
import {
  cancelSettlementSchema,
  createSettlementSchema,
  rejectSettlementSchema,
  reuploadProofSchema,
} from '../validation/settlementSchemas.js';

/** Mounted at /api/groups/:groupId/settlements. Group-scoped by construction. */
const router = Router({ mergeParams: true });

router.use(asyncHandler(requireGroupMember));

router.get('/', asyncHandler(listSettlements));
router.get('/attention', asyncHandler(getAttention));

/** Read-only advice. Never writes, and never changes how debts are stored. */
router.get('/plan', asyncHandler(getSettlementPlan));

/** Pre-fills the settle dialog from server-authoritative figures. */
router.get('/outstanding/:userId', asyncHandler(getOutstanding));

router.post(
  '/',
  requirePermission('settlements.create'),
  rateLimit({ name: 'settlement_create:ip', max: 60, windowMs: 60 * 60_000 }),
  validateBody(createSettlementSchema),
  asyncHandler(createSettlement),
);

router.post('/:settlementId/approve', asyncHandler(approveSettlement));

router.post(
  '/:settlementId/reject',
  validateBody(rejectSettlementSchema),
  asyncHandler(rejectSettlement),
);

router.post(
  '/:settlementId/proof',
  validateBody(reuploadProofSchema),
  asyncHandler(reuploadProof),
);

router.post(
  '/:settlementId/cancel',
  validateBody(cancelSettlementSchema),
  asyncHandler(cancelSettlement),
);

export default router;
