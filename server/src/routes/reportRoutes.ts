import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { requireGroupMember } from '../middleware/requireGroupMember.js';
import { validateQuery } from '../middleware/validate.js';
import { exportQuerySchema, reportFiltersSchema } from '../validation/reportSchemas.js';
import { exportReport, getRelationships, getReport } from '../controllers/reportController.js';
import { requirePermission } from '../middleware/requirePermission.js';

/**
 * Mounted at /api/groups/:groupId/reports.
 *
 * The group is resolved from the caller's proven membership, never from a query
 * parameter, so export filters cannot be used to reach another group's data.
 */
const router = Router({ mergeParams: true });

router.use(asyncHandler(requireGroupMember));

router.get('/dashboard', validateQuery(reportFiltersSchema), asyncHandler(getReport));
router.get('/relationships', validateQuery(reportFiltersSchema), asyncHandler(getRelationships));
router.get(
  '/export',
  requirePermission('reports.export'),
  validateQuery(exportQuerySchema),
  asyncHandler(exportReport),
);

export default router;
