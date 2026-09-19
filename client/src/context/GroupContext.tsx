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
 */

const STORAGE_KEY = 'splitwise:activeGroupId';

interface GroupContextValue {
  groups: Group[];
  activeGroup: Group | null;
  activeGroupId: string | null;
  isLoading: boolean;
  error: string | null;
  setActiveGroupId: (groupId: string) => void;
  refreshGroups: () => Promise<Group[]>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshGroups = useCallback(async (): Promise<Group[]> => {
    try {
      const { groups: fetched } = await listGroups();
      setGroups(fetched);
      setError(null);

      setActiveGroupIdState((current) => {
        // Keep the current selection when it is still a group we belong to.
        if (current && fetched.some((group) => group.id === current)) return current;
        const fallback = fetched[0]?.id ?? null;
        writeStoredId(fallback);
        return fallback;
      });

      return fetched;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load your groups.');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setGroups([]);
      setActiveGroupIdState(null);
      writeStoredId(null);
      setIsLoading(false);
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

  const value = useMemo<GroupContextValue>(
    () => ({
      groups,
      activeGroup,
      activeGroupId: activeGroup?.id ?? null,
      isLoading: isLoading || authLoading,
      error,
      setActiveGroupId,
      refreshGroups,
      hasGroups: groups.length > 0,
    }),
    [groups, activeGroup, isLoading, authLoading, error, setActiveGroupId, refreshGroups],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroups = (): GroupContextValue => {
  const context = useContext(GroupContext);
  if (!context) throw new Error('useGroups must be used within a GroupProvider');
  return context;
};
