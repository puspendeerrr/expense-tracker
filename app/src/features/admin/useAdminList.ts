import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pagination } from '@/api/types';

export const ADMIN_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

type Page<T> = { rows: T[]; pagination: Pagination };

export type AdminListState<T> = {
  rows: T[];
  total: number;
  error: unknown;
  /** First page, nothing on screen yet. */
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => void;
};

/**
 * One paged admin list: debounced search, filters, pull-to-refresh and "load more".
 *
 * The server does the searching, filtering and counting; this only asks for the next
 * slice and appends it. Every request carries a sequence number, so a slow reply for an
 * old search can never overwrite the list for the current one.
 *
 * `key` is anything that changes the query (search text, filter values). When it
 * changes the list starts again from the first page.
 */
export function useAdminList<T>(
  fetchPage: (offset: number, signal: AbortSignal) => Promise<Page<T>>,
  key: string,
  search: string,
): AdminListState<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const offset = useRef(0);

  const run = useCallback(async (mode: 'first' | 'refresh' | 'more'): Promise<void> => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++sequence.current;
    const from = mode === 'more' ? offset.current : 0;

    if (mode === 'first') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);

    try {
      const page = await fetchRef.current(from, abort.signal);
      if (id !== sequence.current) return;
      setRows((previous) => (mode === 'more' ? [...previous, ...page.rows] : page.rows));
      offset.current = from + page.rows.length;
      setTotal(page.pagination.total);
      setHasMore(page.pagination.hasMore);
      setError(undefined);
    } catch (caught: unknown) {
      if (id !== sequence.current || abort.signal.aborted) return;
      setError(caught);
    } finally {
      if (id === sequence.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Search waits for typing to pause; filter changes go at once. Either way, a new query
  // starts from the first page.
  useEffect(() => {
    const timer = setTimeout(() => void run('first'), search ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [key, search, run]);

  useEffect(() => () => controller.current?.abort(), []);

  const loadMore = useCallback((): void => {
    if (!hasMore || loading || loadingMore || refreshing || error) return;
    void run('more');
  }, [hasMore, loading, loadingMore, refreshing, error, run]);

  const refresh = useCallback(() => run('refresh'), [run]);

  return { rows, total, error, loading, refreshing, loadingMore, hasMore, refresh, loadMore };
}
