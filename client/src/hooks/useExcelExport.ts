import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { ReportFilters, buildReportQuery } from './useReportFilters';

/**
 * Downloads the server-generated .xlsx for a given filter scope.
 *
 * The same `buildReportQuery` used by the dashboard builds the export query, so the workbook's
 * scope is guaranteed identical to what the user is looking at.
 *
 * Repeat clicks are ignored while a generation is in flight, so double-tapping on mobile cannot
 * kick off two downloads.
 */
export const useExcelExport = (
  onSuccess: (message: string) => void,
  onError: (message: string) => void
) => {
  const [isExporting, setIsExporting] = useState(false);
  const inFlight = useRef(false);

  const exportReport = useCallback(
    async (filters: ReportFilters) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setIsExporting(true);

      try {
        const params = buildReportQuery(filters);
        params.set('format', 'xlsx');

        const res = await api.get(`/reports/export?${params.toString()}`, {
          responseType: 'blob',
          timeout: 120000,
        });

        // A failed request can still arrive as a blob; surface the JSON error rather than
        // silently saving a corrupt file.
        const contentType = String(res.headers?.['content-type'] || '');
        if (contentType.includes('application/json')) {
          const text = await (res.data as Blob).text();
          let message = 'Unable to generate report. Please try again.';
          try {
            message = JSON.parse(text).message || message;
          } catch {
            /* keep the default message */
          }
          throw new Error(message);
        }

        // Prefer the server's filename so the workbook is named consistently everywhere.
        const disposition = String(res.headers?.['content-disposition'] || '');
        const match = /filename="?([^";]+)"?/.exec(disposition);
        const filename = match ? match[1] : `SplitWise-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;

        const blob = new Blob([res.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoke on the next tick so the download has definitely started (needed on Android WebView).
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);

        onSuccess('Financial report exported successfully.');
        return true;
      } catch (err: unknown) {
        const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        const thrownMessage = err instanceof Error ? err.message : null;
        onError(apiMessage || thrownMessage || 'Unable to generate report. Please try again.');
        return false;
      } finally {
        inFlight.current = false;
        setIsExporting(false);
      }
    },
    [onSuccess, onError]
  );

  return { isExporting, exportReport };
};
