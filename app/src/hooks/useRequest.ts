import { useCallback, useEffect, useRef, useState } from 'react';

export type RequestState<T> = {
  data: T | undefined;
  error: unknown;
  /** True only on the first load, when there is nothing on screen yet. */
  loading: boolean;
  /** True while a pull-to-refresh runs, with the previous data still showing. */
  refreshing: boolean;
  refresh: () => Promise<void>;
};

/**
 * Runs a request and keeps the four things a screen needs to know about it.
 *
 * The distinction that matters is `loading` against `refreshing`. A first load has
 * nothing to show and wants a spinner in the middle of the screen; a refresh already has
 * a list on screen and must not throw it away, or every pull-to-refresh would blank the
 * page and jump the scroll position back to the top.
 *
 * A failed refresh keeps the old data too. Stale groups are more use than an error page
 * where the list used to be.
 */
export function useRequest<T>(
  run: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[] = [],
): RequestState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // `run` is almost always an inline arrow, so depending on it directly would refetch on
  // every render. The caller's `deps` are the real trigger; this just keeps the latest
  // function available to call.
  const runRef = useRef(run);
  runRef.current = run;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = useCallback(async (signal: AbortSignal, isRefresh: boolean): Promise<void> => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await runRef.current(signal);
      if (signal.aborted || !mounted.current) return;
      setData(result);
      setError(undefined);
    } catch (caught: unknown) {
      if (signal.aborted || !mounted.current) return;
      setError(caught);
    } finally {
      if (!signal.aborted && mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void execute(controller.signal, false);
    // Cancels the in-flight request when the screen goes away, so a reply cannot land on
    // an unmounted component.
    return () => controller.abort();
  }, deps);

  const refresh = useCallback(async (): Promise<void> => {
    const controller = new AbortController();
    await execute(controller.signal, true);
  }, [execute]);

  return { data, error, loading, refreshing, refresh };
}
