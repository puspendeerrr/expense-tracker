import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireGroupMember } from '../middleware/requireGroupMember.js';
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from '../controllers/expenseController.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
} from '../validation/expenseSchemas.js';

/**
 * Mounted at /api/groups/:groupId/expenses.
 *
 * Nesting under the group is deliberate: every expense route is structurally
 * group-scoped, so there is no flat /api/expenses/:id that could be reached without
 * naming a group. `mergeParams` gives these handlers the parent's `:groupId`, which
 * `requireGroupMember` then proves.
 */
const router = Router({ mergeParams: true });

// Applies to every route below; the session is already loaded by the parent router.
router.use(asyncHandler(requireGroupMember));

router.get('/', validateQuery(listExpensesQuerySchema), asyncHandler(listExpenses));

router.post(
  '/',
  requirePermission('expenses.create'),
  rateLimit({ name: 'expense_create:ip', max: 120, windowMs: 60 * 60_000 }),
  validateBody(createExpenseSchema),
  asyncHandler(createExpense),
);

router.get('/:expenseId', asyncHandler(getExpense));

router.patch(
  '/:expenseId',
  requirePermission('expenses.modify'),
  validateBody(updateExpenseSchema),
  asyncHandler(updateExpense),
);

router.delete('/:expenseId', requirePermission('expenses.modify'), asyncHandler(deleteExpense));

export default router;
