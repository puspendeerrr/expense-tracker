import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { DashboardReport } from '../types/reports';
import { ReportFilters, buildReportQuery } from './useReportFilters';

/**
 * Loads the dashboard report and keeps it in sync with the existing Socket.IO event stream.
 *
 * Race-condition handling:
 *  - Socket events are coalesced through a short debounce, so a burst (e.g. an expense create
 *    that emits both `notification` and `settlement:updated`) triggers exactly one refetch.
 *  - Every response carries a monotonic request id; a slower earlier response can never
 *    overwrite a newer one.
 *  - Refreshes triggered by sockets keep the previous data on screen and only flag `isRefreshing`,
 *    so live updates never flash empty financial figures.
 */

interface UseDashboardReportResult {
  report: DashboardReport | null;
  isLoading: boolean;      // first load only — drives skeletons
  isRefreshing: boolean;   // background refresh — drives the subtle sync indicator
  error: string | null;
  lastUpdated: Date | null;
  refresh: (opts?: { silent?: boolean }) => void;
}

const SOCKET_DEBOUNCE_MS = 400;

export const useDashboardReport = (
  filters: ReportFilters,
  groupBy: 'auto' | 'day' | 'week' | 'month',
  socket: { on: Function; off: Function } | null,
  enabled: boolean
): UseDashboardReportResult => {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const requestSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  // Keep the latest filters in a ref so socket handlers never close over stale values.
  const filtersRef = useRef(filters);
  const groupByRef = useRef(groupBy);
  filtersRef.current = filters;
  groupByRef.current = groupBy;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!enabled) return;

      const seq = ++requestSeq.current;
      const hasData = report !== null;

      if (opts.silent || hasData) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const params = buildReportQuery(filtersRef.current);
        params.set('groupBy', groupByRef.current);

        const res = await api.get(`/reports/dashboard?${params.toString()}`);

        // Discard a stale response that lost the race to a newer request.
        if (seq !== requestSeq.current || !isMounted.current) return;

        setReport(res.data);
        setError(null);
        setLastUpdated(new Date());
      } catch (err: unknown) {
        if (seq !== requestSeq.current || !isMounted.current) return;
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Unable to load your dashboard. Please try again.';
        setError(message);
      } finally {
        if (seq === requestSeq.current && isMounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    // `report` is intentionally excluded: it is read only to decide the loading style, and
    // including it would recreate this callback on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled]
  );

  // Refetch whenever the filter scope changes.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.preset,
    filters.customFrom,
    filters.customTo,
    filters.memberId,
    filters.paymentMode,
    filters.involvement,
    groupBy,
    enabled,
  ]);

  // Reuse the existing Socket.IO events — no new realtime mechanism.
  useEffect(() => {
    if (!socket || !enabled) return;

    const scheduleRefresh = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        load({ silent: true });
      }, SOCKET_DEBOUNCE_MS);
    };

    // `notification` covers expense created/updated/deleted, settlement submitted/approved/
    // rejected, member joined/removed and payday updates. `settlement:updated` is the group-room
    // broadcast. Both are debounced into a single refetch.
    socket.on('notification', scheduleRefresh);
    socket.on('settlement:updated', scheduleRefresh);

    return () => {
      socket.off('notification', scheduleRefresh);
      socket.off('settlement:updated', scheduleRefresh);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [socket, enabled, load]);

  const refresh = useCallback(
    (opts: { silent?: boolean } = {}) => {
      load(opts);
    },
    [load]
  );

  return { report, isLoading, isRefreshing, error, lastUpdated, refresh };
};
