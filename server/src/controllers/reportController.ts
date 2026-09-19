import type { Request, Response } from 'express';
import { sendOk } from '../utils/http.js';
import { validatedQuery } from '../middleware/validate.js';
import { reportFiltersSchema } from '../validation/reportSchemas.js';
import {
  buildAnalyticsRegion,
  buildChartRegion,
  buildExportDataset,
  buildFullReport,
  buildLiveRegion,
  mergeRelationships,
  type ReportContext,
} from '../services/reportingService.js';
import { generateFinancialReport } from '../services/excelExportService.js';

const contextFrom = (req: Request): ReportContext => ({
  group: req.group!,
  membership: req.membership!,
  userId: req.user!.id,
  // Already parsed by `validateQuery`, so a bad filter is a 400 before we get here.
  filters: validatedQuery(req, reportFiltersSchema),
});

/**
 * Scoped dashboard report.
 *
 * The client fetches `live`, `analytics` and `chart` as independent regions so that
 * changing a date filter refetches only the analytics and chart, leaving current
 * balances and the rest of the page untouched. `full` exists for the export path.
 */
export const getReport = async (req: Request, res: Response): Promise<void> => {
  const ctx = contextFrom(req);

  switch (ctx.filters.scope) {
    case 'live': {
      const live = await buildLiveRegion(ctx);
      // `debts` is the raw graph, needed only to merge relationships server-side.
      const { debts, ...payload } = live;
      void debts;
      sendOk(res, payload);
      return;
    }

    case 'analytics': {
      const analytics = await buildAnalyticsRegion(ctx);
      sendOk(res, analytics);
      return;
    }

    case 'chart': {
      sendOk(res, await buildChartRegion(ctx));
      return;
    }

    default: {
      const report = await buildFullReport(ctx);
      const { debts, ...payload } = report;
      void debts;
      sendOk(res, payload);
    }
  }
};

/**
 * Relationship table: attribution merged with live obligations.
 *
 * Served as its own region because it is the one view that genuinely needs both halves,
 * and merging them on the server keeps the client from re-deriving financial figures.
 */
export const getRelationships = async (req: Request, res: Response): Promise<void> => {
  const ctx = contextFrom(req);
  const [live, analytics] = await Promise.all([buildLiveRegion(ctx), buildAnalyticsRegion(ctx)]);

  sendOk(res, {
    relationships: mergeRelationships(analytics.relationships, live.debts, ctx.userId),
  });
};

/**
 * Streams the filtered scope as an .xlsx workbook.
 *
 * Uses `buildExportDataset`, which runs the identical filter pipeline as the dashboard,
 * so the workbook always represents exactly what the user was looking at.
 */
export const exportReport = async (req: Request, res: Response): Promise<void> => {
  const ctx = contextFrom(req);
  const dataset = await buildExportDataset(ctx);

  const { buffer, filename } = await generateFinancialReport(dataset, {
    fullName: req.user!.fullName,
    email: req.user!.email,
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  // Lets the browser fetch layer read the filename for the download.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.setHeader('Cache-Control', 'no-store');

  res.status(200).send(buffer);
};
