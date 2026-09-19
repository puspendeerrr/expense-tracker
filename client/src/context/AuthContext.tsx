import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '../types/auth';
import { apiRequest } from '../lib/api';

/**
 * Session and permissions.
 *
 * The permission set here decides only what the UI offers. Every capability is enforced
 * again on the server for each request, so hiding a control is a courtesy to the user,
 * never a security boundary. A stale set in this context can therefore be wrong without
 * being dangerous: the worst case is a button that returns a clear 403.
 */

interface AuthContextType {
  user: User | null;
  /** Effective permission keys for the signed-in user; empty when anonymous. */
  permissions: Set<string>;
  /** Convenience for the common check. */
  can: (permission: string) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: User; permissions?: string[] }>('/api/auth/me');
      setUser(data.user);
      setPermissions(new Set(data.permissions ?? []));
    } catch {
      setUser(null);
      setPermissions(new Set());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await apiRequest<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    // Login does not carry the permission set, so fetch it before the app renders
    // anything that depends on it.
    await refreshUser();
    return data.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if network fails, drop client state
    } finally {
      setUser(null);
      setPermissions(new Set());
    }
  };

  const can = useCallback(
    (permission: string) => user?.role === 'admin' || permissions.has(permission),
    [permissions, user?.role],
  );

  const value = useMemo(
    () => ({
      user,
      permissions,
      can,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      setUser,
      refreshUser,
    }),
    // `login` and `logout` are stable enough in practice; the rest are memoised.
    [user, permissions, can, isLoading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** Shorthand for gating a control on one capability. */
export const useCan = (permission: string): boolean => useAuth().can(permission);
