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

/**
 * A comma-separated list of ids, as a query string can carry it.
 *
 * Capped at 50 so a crafted query cannot ask the database to match an unbounded IN
 * list, and de-duplicated so repeating one id fifty times is not a way around that.
 */
const uuidListSchema = z
  .string()
  .trim()
  .transform((value) => [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))])
  .refine((ids) => ids.length > 0 && ids.length <= 50, {
    message: 'Select between 1 and 50 people',
  })
  .refine((ids) => ids.every((id) => z.string().uuid().safeParse(id).success), {
    message: 'Every person id must be a UUID',
  });

/** The sheets an export can contain. */
export const EXPORT_SECTIONS = [
  'summary',
  'expenses',
  'splits',
  'relationships',
  'settlements',
  'period',
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

const sectionListSchema = z
  .string()
  .trim()
  .transform((value) => [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))])
  .refine((list) => list.length > 0, { message: 'Choose at least one section to export' })
  .refine((list) => list.every((item) => (EXPORT_SECTIONS as readonly string[]).includes(item)), {
    message: 'Unknown export section',
  })
  .transform((list) => list as ExportSection[]);

export const reportScopeSchema = z.enum(['full', 'live', 'analytics', 'chart']);

/**
 * The filter fields themselves.
 *
 * Shared as a shape rather than composing the finished schemas with `.and()`. An
 * intersection parses the input with both halves and merges the results, and these
 * fields transform (a comma-separated string becomes an array), so the two halves
 * produce different values for the same key and Zod rejects the whole request with
 * "Intersection results could not be merged". Building each schema from one shape
 * avoids that entirely.
 */
const reportFilterShape = {
  scope: reportScopeSchema.default('full'),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  memberId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
  /**
   * Several people at once, for the export. Takes precedence over `memberId` when
   * present; the dashboard still sends the single-value form.
   */
  memberIds: uuidListSchema.optional(),
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
};

const orderedRange = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (data) => {
      const { from, to } = data as { from?: string; to?: string };
      return !from || !to || from <= to;
    },
    { path: ['from'], message: '"from" must not be after "to"' },
  );

export const reportFiltersSchema = orderedRange(
  z.object(reportFilterShape).passthrough(),
);

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

/**
 * Export query: the dashboard filters plus which sheets to produce.
 *
 * A sheet selection means nothing to the dashboard endpoints, so it lives only here
 * rather than being accepted everywhere and silently ignored.
 */
export const exportQuerySchema = orderedRange(
  z
    .object({
      ...reportFilterShape,
      sections: sectionListSchema.optional(),
    })
    .passthrough(),
);
