import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientError } from '@/lib/api';

/**
 * List state for the admin screens: search, paging, sorting and the fetch lifecycle.
 *
 * Two details that matter more than they look:
 *
 * - Each fetch aborts the previous one. Typing into a search box otherwise leaves
 *   several requests racing and the slowest reply wins, so the list ends up showing
 *   results for a term the user has already changed.
 * - The first load and a refetch are distinguished. A refetch keeps the current rows on
 *   screen and dims them, rather than replacing a populated table with skeletons on
 *   every keystroke.
 */

const DEBOUNCE_MS = 300;

export type SortDirection = 'asc' | 'desc';

export interface AdminListState<T> {
  rows: T[] | null;
  total: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  search: string;
  setSearch: (value: string) => void;
  /** Debounced value, safe to send to the server. */
  debouncedSearch: string;

  offset: number;
  limit: number;
  setOffset: (value: number) => void;

  sortColumn: string | null;
  sortDirection: SortDirection;
  toggleSort: (column: string) => void;

  reload: () => void;
}

export function useAdminList<T>(
  fetcher: (params: {
    limit: number;
    offset: number;
    search?: string;
    signal: AbortSignal;
  }) => Promise<{ rows: T[]; total: number }>,
  options: { limit?: number; defaultSort?: string; deps?: unknown[] } = {},
): AdminListState<T> {
  const limit = options.limit ?? 25;
  const deps = options.deps ?? [];

  const [rows, setRows] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(options.defaultSort ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [reloadKey, setReloadKey] = useState(0);

  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  // A new search term invalidates the current page number.
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch]);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    const controller = new AbortController();

    if (hasLoadedOnce.current) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);

    void fetcher({
      limit,
      offset,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRows(data.rows);
        setTotal(data.total);
        hasLoadedOnce.current = true;
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiClientError ? err.message : 'Could not load that list.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
        setIsRefreshing(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, debouncedSearch, reloadKey, depsKey]);

  const toggleSort = useCallback((column: string) => {
    setSortColumn((current) => {
      if (current === column) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDirection('asc');
      return column;
    });
  }, []);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return useMemo(
    () => ({
      rows,
      total,
      isLoading,
      isRefreshing,
      error,
      search,
      setSearch,
      debouncedSearch,
      offset,
      limit,
      setOffset,
      sortColumn,
      sortDirection,
      toggleSort,
      reload,
    }),
    [
      rows,
      total,
      isLoading,
      isRefreshing,
      error,
      search,
      debouncedSearch,
      offset,
      limit,
      sortColumn,
      sortDirection,
      toggleSort,
      reload,
    ],
  );
}

/**
 * Sorts a page of rows in the browser.
 *
 * Deliberately client-side and deliberately limited: it orders the rows already
 * fetched, not the whole table. The admin list endpoints have a fixed server order, and
 * pretending otherwise -- sorting one page and labelling it as sorted overall -- would
 * be a lie about the data. Where a true global sort is needed the server has to provide
 * it, and that is noted as a gap rather than faked here.
 */
export function sortRows<T>(
  rows: T[],
  column: string | null,
  direction: SortDirection,
  accessor: (row: T, column: string) => string | number | null,
): T[] {
  if (!column) return rows;

  return [...rows].sort((a, b) => {
    const left = accessor(a, column);
    const right = accessor(b, column);

    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;

    const comparison =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));

    return direction === 'asc' ? comparison : -comparison;
  });
}
