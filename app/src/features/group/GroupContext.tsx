import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { groups as groupsApi } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import type { GroupDetail, LiveRegion } from '@/api/types';
import { useGroupRealtime } from '@/realtime/SocketProvider';

/**
 * Everything a group's screens share: the group, its members, and the live balances.
 *
 * WHY A CONTEXT AND NOT SIX FETCHES
 * The six sections of a group all need the member list, and four of them need the live
 * balance figures. Fetching those per section would be the N+1 problem in UI form: every
 * tab switch would re-request the same two payloads, and two sections could briefly
 * disagree about what someone owes. Loading them once here means switching sections is
 * free, and one refresh updates every section at the same instant.
 *
 * WHERE THE NUMBERS COME FROM
 * `live` is `scope=live` from the reports endpoint — the server's authoritative current
 * picture. Nothing here recomputes, nets or adjusts any figure in it. Realtime events are
 * treated purely as a signal to refetch; no balance is ever patched from an event payload,
 * because an event says what happened, not what everything now adds up to.
 */

export type GroupAccess = 'loading' | 'ready' | 'denied' | 'missing' | 'error';

type GroupContextValue = {
  groupId: string;
  access: GroupAccess;
  detail: GroupDetail | undefined;
  live: LiveRegion | undefined;
  error: unknown;
  /** True while a refresh runs with content already on screen. */
  refreshing: boolean;
  refresh: () => Promise<void>;
  /** Bumped whenever group data changes, so lists owned by sections can refetch too. */
  revision: number;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ groupId, children }: PropsWithChildren<{ groupId: string }>) {
  const [detail, setDetail] = useState<GroupDetail | undefined>(undefined);
  const [live, setLive] = useState<LiveRegion | undefined>(undefined);
  const [access, setAccess] = useState<GroupAccess>('loading');
  const [error, setError] = useState<unknown>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (signal: AbortSignal, isRefresh: boolean): Promise<void> => {
      if (isRefresh) setRefreshing(true);

      try {
        /*
         * Both in one round trip rather than in sequence. They are independent, and
         * waiting for the first before starting the second would double the time the
         * user spends looking at a skeleton.
         */
        const [nextDetail, nextLive] = await Promise.all([
          groupsApi.get(groupId, signal),
          groupsApi.live(groupId, signal),
        ]);

        if (signal.aborted || !mounted.current) return;
        setDetail(nextDetail);
        setLive(nextLive);
        setError(undefined);
        setAccess('ready');
        setRevision((value) => value + 1);
      } catch (caught: unknown) {
        if (signal.aborted || !mounted.current) return;

        /*
         * These three are ordinary situations, not faults, and each deserves its own
         * sentence rather than a generic error card:
         *   403  removed from the group, or the group was disabled
         *   404  the group was deleted, or the id is not one this user can see
         *   else the network, or the server
         *
         * A 401 is not handled here: the API client already announced the session loss
         * and the whole app is on its way to the sign-in screen.
         */
        if (caught instanceof ApiError && caught.status === 403) setAccess('denied');
        else if (caught instanceof ApiError && caught.status === 404) setAccess('missing');
        else setAccess('error');

        setError(caught);
      } finally {
        if (!signal.aborted && mounted.current) setRefreshing(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    // A different group means the previous one's data must not linger on screen.
    setAccess('loading');
    setDetail(undefined);
    setLive(undefined);
    setError(undefined);

    const controller = new AbortController();
    void load(controller.signal, false);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(async (): Promise<void> => {
    const controller = new AbortController();
    await load(controller.signal, true);
  }, [load]);

  /*
   * Realtime. Every event this group emits changes either who owes what or who is in it,
   * so the response is the same in each case: refetch the two payloads this context owns.
   * Sections holding their own lists watch `revision` and refetch alongside.
   *
   * Refetching rather than patching is the deliberate choice. Applying a delta locally
   * would be a second balance calculation living on the phone, which is exactly what must
   * not exist.
   */
  useGroupRealtime(groupId, () => {
    void refresh();
  });

  const value = useMemo<GroupContextValue>(
    () => ({ groupId, access, detail, live, error, refreshing, refresh, revision }),
    [groupId, access, detail, live, error, refreshing, refresh, revision],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup(): GroupContextValue {
  const value = useContext(GroupContext);
  if (!value) throw new Error('useGroup requires GroupProvider');
  return value;
}

/** The members of the current group, or an empty list while it loads. */
export function useMembers() {
  const { detail } = useGroup();
  return detail?.members ?? [];
}

/** Looks a person up by id, falling back to a placeholder for someone who has left. */
export function useMemberLookup() {
  const members = useMembers();
  return useMemo(() => {
    const byId = new Map(members.map((member) => [member.id, member]));
    return (userId: string) =>
      byId.get(userId) ?? {
        id: userId,
        fullName: 'Former member',
        email: '',
        upiId: null,
        qrCodeUrl: null,
      };
  }, [members]);
}
