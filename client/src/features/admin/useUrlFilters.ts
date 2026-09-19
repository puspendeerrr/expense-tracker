import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filter state held in the URL rather than in component state.
 *
 * An operator investigating something builds up a filter set and then wants to send it
 * to a colleague, open it in a second tab, or come back to it after following a link
 * into a detail screen. None of that works if the filters live only in React state, so
 * the query string is the single source of truth and the components read from it.
 *
 * Empty values are removed rather than written as `key=`, so a URL only ever carries
 * the filters that are actually doing something.
 */
export function useUrlFilters<K extends string>(
  keys: readonly K[],
  defaults: Partial<Record<K, string>> = {},
) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const result = {} as Record<K, string>;
    for (const key of keys) {
      result[key] = params.get(key) ?? defaults[key] ?? '';
    }
    return result;
    // `params` is a new object on every navigation, so its string form is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString(), keys.join(','), JSON.stringify(defaults)]);

  const setFilter = useCallback(
    (key: K, value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const isDefault = value === '' || value === defaults[key];
          if (isDefault) next.delete(key);
          else next.set(key, value);
          // Any filter change invalidates the page number.
          next.delete('offset');
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  const reset = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of keys) next.delete(key);
        next.delete('offset');
        return next;
      },
      { replace: true },
    );
  }, [setParams, keys]);

  /** Which filters are currently narrowing the result set. */
  const active = useMemo(
    () => keys.filter((key) => values[key] !== '' && values[key] !== defaults[key]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys.join(','), JSON.stringify(values), JSON.stringify(defaults)],
  );

  return { values, setFilter, reset, active, hasFilters: active.length > 0 };
}
