import { z } from 'zod';

/**
 * Report filters.
 *
 * Dates are plain calendar days (`YYYY-MM-DD`) matching the `expense_date` column, not
 * instants. The reference had to accept resolved ISO instants plus a timezone offset to
 * avoid UTC off-by-one errors; storing a date makes all of that unnecessary -- the day a
 * user picks is the day the server filters on.
 */

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be in YYYY-MM-DD format');

export const reportScopeSchema = z.enum(['full', 'live', 'analytics', 'chart']);

export const reportFiltersSchema = z
  .object({
    scope: reportScopeSchema.default('full'),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    memberId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
    paymentMode: z.enum(['all', 'cash', 'upi']).default('all'),
    involvement: z
      .enum(['all', 'involving_me', 'paid_by_me', 'paid_by_others_for_me'])
      .default('all'),
    category: z.string().trim().max(40).optional(),
    groupBy: z.enum(['auto', 'day', 'week', 'month']).default('auto'),
    /** Display-only label echoed into the exported workbook. */
    rangeLabel: z.string().trim().max(120).optional(),
    preset: z.string().trim().max(40).optional(),
    groupId: z.string().uuid().optional(),
  })
  .passthrough()
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    path: ['from'],
    message: '"from" must not be after "to"',
  });

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export const exportQuerySchema = reportFiltersSchema;
