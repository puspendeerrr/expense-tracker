import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listGroups } from '@/lib/domainApi';
import { useAuth } from '@/context/AuthContext';
import type { Group } from '@/types/domain';

/**
 * Active-group selection for multi-group membership.
 *
 * The selection is a UI preference only. It is remembered in localStorage so a reload
 * lands you back where you were, but it is never trusted: every request names the group
 * explicitly and the server re-proves membership. A stale or tampered id simply fails
 * the membership check and the selection falls back to the first real group.
 *
 * Membership is modelled as an explicit status rather than a boolean, because consumers
 * need to tell three states apart that a boolean collapses into two:
 *
 *   loading  we do not know yet
 *   ready    we know, and the answer may be "none"
 *   error    we asked and could not find out
 *
 * That distinction is not academic. "Loading" and "you have no groups" rendering the
 * same screen is what produced the Create/Join flash after login, and "error" rendering
 * it too would tell someone their groups had vanished when the request merely failed.
 */

const STORAGE_KEY = 'splitmoney:activeGroupId';

export type GroupStatus = 'loading' | 'ready' | 'error';

interface GroupContextValue {
  groups: Group[];
  activeGroup: Group | null;
  activeGroupId: string | null;
  status: GroupStatus;
  /** True until membership has been resolved one way or the other. */
  isLoading: boolean;
  error: string | null;
  setActiveGroupId: (groupId: string) => void;
  refreshGroups: () => Promise<Group[]>;
  /** Only meaningful once `status` is 'ready'. */
  hasGroups: boolean;
}

const GroupContext = createContext<GroupContextValue | undefined>(undefined);

const readStoredId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: fall back to "first group".
    return null;
  }
};

const writeStoredId = (groupId: string | null): void => {
  try {
    if (groupId) localStorage.setItem(STORAGE_KEY, groupId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal: the selection just will not survive a reload.
  }
};

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(readStoredId);
  const [status, setStatus] = useState<GroupStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const refreshGroups = useCallback(async (): Promise<Group[]> => {
    /*
     * Back to 'loading' on every fetch, including a refetch.
     *
     * This is the fix for the post-login flash. Signing in flips the provider from the
     * anonymous branch -- which had already resolved to "no groups" -- straight to an
     * authenticated fetch. Without resetting here, the moment between those two states
     * reads as "resolved, and you belong to nothing", and the dashboard renders its
     * empty state for as long as the request takes.
     */
    setStatus('loading');
    setError(null);

    try {
      const { groups: fetched } = await listGroups();
      setGroups(fetched);

      setActiveGroupIdState((current) => {
        // Keep the current selection when it is still a group we belong to. A group that
        // was deleted, or that we were removed from, falls back to the first real one.
        if (current && fetched.some((group) => group.id === current)) return current;
        const fallback = fetched[0]?.id ?? null;
        writeStoredId(fallback);
        return fallback;
      });

      setStatus('ready');
      return fetched;
    } catch (err: unknown) {
      // Deliberately not 'ready'. A failed request means we do not know what groups
      // exist, which is a different thing from knowing there are none.
      setError(err instanceof Error ? err.message : 'Could not load your groups.');
      setStatus('error');
      return [];
    }
  }, []);

  useEffect(() => {
    // Auth has not resolved yet; staying in 'loading' is correct.
    if (authLoading) return;

    if (!isAuthenticated) {
      setGroups([]);
      setActiveGroupIdState(null);
      writeStoredId(null);
      setError(null);
      setStatus('ready');
      return;
    }

    void refreshGroups();
  }, [isAuthenticated, authLoading, refreshGroups]);

  const setActiveGroupId = useCallback((groupId: string) => {
    setActiveGroupIdState(groupId);
    writeStoredId(groupId);
  }, []);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  // Auth still resolving means membership cannot be known yet, whatever this provider's
  // own status says.
  const effectiveStatus: GroupStatus = authLoading ? 'loading' : status;

  const value = useMemo<GroupContextValue>(
    () => ({
      groups,
      activeGroup,
      activeGroupId: activeGroup?.id ?? null,
      status: effectiveStatus,
      isLoading: effectiveStatus === 'loading',
      error,
      setActiveGroupId,
      refreshGroups,
      hasGroups: groups.length > 0,
    }),
    [groups, activeGroup, effectiveStatus, error, setActiveGroupId, refreshGroups],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroups = (): GroupContextValue => {
  const context = useContext(GroupContext);
  if (!context) throw new Error('useGroups must be used within a GroupProvider');
  return context;
};
