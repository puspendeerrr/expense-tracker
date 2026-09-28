import { useCallback, useEffect, useRef, useState } from 'react';
import { search as searchApi } from '@/api/endpoints';
import type { SearchResults } from '@/api/types';

/** The server refuses shorter queries with a 400 (`q.min(2)`), so none are sent. */
export const MIN_QUERY = 2;
/** Long enough to let a word finish, short enough to feel live. */
export const SEARCH_DEBOUNCE_MS = 300;

export type SearchState =
  | { kind: 'idle' }
  | { kind: 'short' }
  | { kind: 'loading'; query: string; previous: SearchResults | null }
  | { kind: 'success'; query: string; results: SearchResults }
  | { kind: 'error'; query: string; error: unknown };

export const isEmptyResults = (results: SearchResults): boolean =>
  Object.values(results).every((list) => list.length === 0);

/**
 * Query-driven search against `GET /api/search`.
 *
 * ONLY THE LATEST QUERY CAN WIN. Every request gets a sequence number; a reply is applied
 * only if its number is still the latest, and the request before it is aborted as soon as
 * a newer one starts. So "piz" answering after "pizza" is dropped rather than drawn over
 * the newer results — whichever order the network returns them in.
 *
 * NOTHING WASTED. Typing is debounced; queries under two characters (after trimming) are
 * never sent, because the server would only refuse them; and re-asking the query already
 * shown does nothing. Unmounting aborts whatever is in flight.
 *
 * No realtime here: search runs when the query changes or the person asks to retry, not
 * whenever something happens somewhere in a group.
 */
export function useGlobalSearch(raw: string) {
  const [state, setState] = useState<SearchState>({ kind: 'idle' });

  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const shown = useRef<string | null>(null);
  const lastResults = useRef<SearchResults | null>(null);

  const run = useCallback((query: string, force = false) => {
    if (!force && shown.current === query) return;

    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const id = (sequence.current += 1);

    setState({ kind: 'loading', query, previous: lastResults.current });

    searchApi
      .query(query, { limit: 5 }, current.signal)
      .then((results) => {
        if (id !== sequence.current) return;
        shown.current = query;
        lastResults.current = results;
        setState({ kind: 'success', query, results });
      })
      .catch((error: unknown) => {
        if (id !== sequence.current || current.signal.aborted) return;
        shown.current = null;
        setState({ kind: 'error', query, error });
      });
  }, []);

  useEffect(() => {
    const query = raw.trim();

    if (query.length === 0) {
      controller.current?.abort();
      sequence.current += 1;
      shown.current = null;
      setState({ kind: 'idle' });
      return;
    }
    if (query.length < MIN_QUERY) {
      controller.current?.abort();
      sequence.current += 1;
      shown.current = null;
      setState({ kind: 'short' });
      return;
    }

    const timer = setTimeout(() => run(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [raw, run]);

  useEffect(() => () => controller.current?.abort(), []);

  /** Runs the current query now — for Retry and for the keyboard's search key. */
  const retry = useCallback(() => {
    const query = raw.trim();
    if (query.length >= MIN_QUERY) run(query, true);
  }, [raw, run]);

  return { state, retry };
}
