import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../utils/http.js';
import { loadSession, requireAuth } from '../middleware/requireAuth.js';
import { loadPermissions, requirePermission } from '../middleware/requirePermission.js';
import { validateQuery, validatedQuery } from '../middleware/validate.js';
import { paiseToRupees } from '../utils/money.js';
import * as spendingService from '../services/spendingService.js';

/**
 * Cross-group insight surfaces. Mounted at /api/insights.
 *
 * Separate from the group-scoped report routes on purpose: everything here reads across
 * group boundaries and is therefore governed by an explicit grant rather than by
 * membership. The scope is resolved from the caller's own id inside the service, so no
 * parameter on this router can widen what is returned.
 */
const router = Router();

router.use(asyncHandler(loadSession), requireAuth, asyncHandler(loadPermissions));

const spendingQuerySchema = z
  .object({
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    groupId: z.string().uuid().optional(),
  })
  .passthrough()
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    path: ['from'],
    message: '"from" must not be after "to"',
  });

router.get(
  '/spending',
  requirePermission('dashboard.spending'),
  validateQuery(spendingQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = validatedQuery(req, spendingQuerySchema);

    const report = await spendingService.getSpendingReport(req.user!.id, {
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
    });

    sendOk(res, {
      ...report,
      people: report.people.map((person) => ({
        ...person,
        spent: paiseToRupees(person.spentPaise),
        paid: paiseToRupees(person.paidPaise),
      })),
      totals: { ...report.totals, spent: paiseToRupees(report.totals.spentPaise) },
    });
  }),
);

export default router;
