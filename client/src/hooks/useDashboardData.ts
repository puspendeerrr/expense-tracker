import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAnalyticsRegion,
  fetchChartRegion,
  fetchLiveRegion,
} from '@/lib/domainApi';
import { buildFilterQuery } from '@/lib/dateRange';
import type {
  AnalyticsRegion,
  ChartRegion,
  LiveRegion,
  RealtimePayload,
  ReportFilters,
} from '@/types/domain';
import { ApiClientError } from '@/lib/api';

/**
 * Dashboard data, split into three independent regions.
 *
 * This is the structure that makes "changing a filter must not reload the dashboard"
 * true by construction rather than by discipline:
 *
 *   live      current balances, dues, members, attention -- NOT date-filtered
 *   analytics period totals, relationships, recent expenses
 *   chart     the time series only
 *
 * Three rules keep the page stable:
 *
 * 1. Each region owns its own request, AbortController and error state. A failure or a
 *    slow response in one never blanks another.
 * 2. A refetch NEVER clears existing data. `data` stays on screen while `isRefreshing`
 *    is true, so sections show a subtle refresh state instead of collapsing to skeletons
 *    and destroying scroll position.
 * 3. Only the regions whose inputs actually changed refetch. Changing the chart grouping
 *    touches `chart` alone; changing a date filter touches `analytics` and `chart` but
 *    leaves `live` -- and therefore every balance on screen -- untouched.
 */

export interface Region<T> {
  data: T | null;
  /** True only before the first successful load: drives skeletons. */
  isLoading: boolean;
  /** True while revalidating with data already on screen: drives a subtle indicator. */
  isRefreshing: boolean;
  error: string | null;
}

const emptyRegion = <T,>(): Region<T> => ({
  data: null,
  isLoading: true,
  isRefreshing: false,
  error: null,
});

type RegionName = 'live' | 'analytics' | 'chart';
export type ChartGrouping = 'auto' | 'day' | 'week' | 'month';

const messageFor = (error: unknown, region: RegionName): string => {
  if (error instanceof ApiClientError) return error.message;
  const label =
    region === 'live' ? 'current balances' : region === 'chart' ? 'the chart' : 'analytics';
  return `Could not load ${label}. Please retry.`;
};

type RegionSetter<T> = React.Dispatch<React.SetStateAction<Region<T>>>;

/**
 * Flags a refresh without discarding what is already on screen.
 *
 * `isLoading` is true only on a cold load, so an established section shows a subtle
 * refreshing state rather than collapsing back to a skeleton.
 */
const markLoading = <T,>(set: RegionSetter<T>): void => {
  set((prev) => ({
    ...prev,
    isLoading: prev.data === null,
    isRefreshing: prev.data !== null,
    error: null,
  }));
};

/** Records a failure while keeping any previously loaded data visible. */
const markError = <T,>(set: RegionSetter<T>, message: string): void => {
  set((prev) => ({ ...prev, isLoading: false, isRefreshing: false, error: message }));
};

export const useDashboardData = (
  groupId: string | null,
  filters: ReportFilters,
  groupBy: ChartGrouping,
) => {
  const [live, setLive] = useState<Region<LiveRegion>>(emptyRegion);
  const [analytics, setAnalytics] = useState<Region<AnalyticsRegion>>(emptyRegion);
  const [chart, setChart] = useState<Region<ChartRegion>>(emptyRegion);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const controllers = useRef<Partial<Record<RegionName, AbortController>>>({});

  // Serialised so the effects below depend on filter *values*, not object identity.
  const filterKey = useMemo(() => buildFilterQuery(filters).toString(), [filters]);

  const load = useCallback(
    async (region: RegionName, key: string, grouping: ChartGrouping) => {
      if (!groupId) return;

      // Supersede any in-flight request for this region only.
      controllers.current[region]?.abort();
      const controller = new AbortController();
      controllers.current[region] = controller;

      // Keep existing data visible; only flag that a refresh is happening.
      if (region === 'live') markLoading(setLive);
      else if (region === 'analytics') markLoading(setAnalytics);
      else markLoading(setChart);

      try {
        const params = new URLSearchParams(key);
        if (region === 'live') {
          const data = await fetchLiveRegion(groupId, controller.signal);
          if (controller.signal.aborted) return;
          setLive({ data, isLoading: false, isRefreshing: false, error: null });
          setLastUpdated(new Date());
        } else if (region === 'analytics') {
          const data = await fetchAnalyticsRegion(groupId, params, controller.signal);
          if (controller.signal.aborted) return;
          setAnalytics({ data, isLoading: false, isRefreshing: false, error: null });
        } else {
          const data = await fetchChartRegion(groupId, params, grouping, controller.signal);
          if (controller.signal.aborted) return;
          setChart({ data, isLoading: false, isRefreshing: false, error: null });
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        // An aborted fetch is a superseded request, not a failure to report.
        if (error instanceof DOMException && error.name === 'AbortError') return;

        const message = messageFor(error, region);
        if (region === 'live') markError(setLive, message);
        else if (region === 'analytics') markError(setAnalytics, message);
        else markError(setChart, message);
      }
    },
    [groupId],
  );

  // LIVE: mount and group change only. Filters deliberately do not appear here.
  useEffect(() => {
    if (!groupId) return;
    void load('live', '', 'auto');
  }, [groupId, load]);

  // ANALYTICS: filters only.
  useEffect(() => {
    if (!groupId) return;
    void load('analytics', filterKey, 'auto');
  }, [groupId, filterKey, load]);

  // CHART: filters plus its own grouping control.
  useEffect(() => {
    if (!groupId) return;
    void load('chart', filterKey, groupBy);
  }, [groupId, filterKey, groupBy, load]);

  // Abort everything still in flight when the group changes or we unmount.
  useEffect(
    () => () => {
      for (const controller of Object.values(controllers.current)) controller?.abort();
      controllers.current = {};
    },
    [groupId],
  );

  const refresh = useCallback(
    (regions: RegionName[] = ['live', 'analytics', 'chart']) => {
      for (const region of regions) {
        void load(region, filterKey, groupBy);
      }
    },
    [load, filterKey, groupBy],
  );

  const retry = useCallback(
    (region: RegionName) => void load(region, filterKey, groupBy),
    [load, filterKey, groupBy],
  );

  /**
   * Applies a realtime event by refetching only the regions it names.
   *
   * The server decides which regions an event invalidates (a settlement touches `live`
   * only; an expense touches all three), so the client never has to guess and can never
   * degrade into "reload everything".
   */
  const applyRealtimeEvent = useCallback(
    (payload: RealtimePayload) => {
      if (payload.groupId !== groupId) return;
      refresh(payload.regions);
    },
    [groupId, refresh],
  );

  return { live, analytics, chart, lastUpdated, refresh, retry, applyRealtimeEvent };
};
