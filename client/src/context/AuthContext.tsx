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

/**
 * Thrown when the credentials were accepted but the session did not survive.
 *
 * Almost always a blocked third-party cookie: the API and the SPA are on different
 * registrable domains, so the session cookie needs `SameSite=None`, and Safari and
 * Brave reject those by default. The request succeeds, the cookie is silently dropped,
 * and the very next call is unauthenticated.
 *
 * Without this the app reports a successful sign-in and then bounces straight back to
 * the login screen, which looks like a bug in the login form rather than a browser
 * privacy setting.
 */
export class SessionNotPersistedError extends Error {
  constructor() {
    super(
      'Signed in, but your browser did not keep the session. This usually means ' +
        'third-party cookies are blocked.',
    );
    this.name = 'SessionNotPersistedError';
  }
}

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
  /** Re-reads the session. Resolves to the signed-in user, or null when anonymous. */
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const data = await apiRequest<{ user: User; permissions?: string[] }>('/api/auth/me');
      setUser(data.user);
      setPermissions(new Set(data.permissions ?? []));
      return data.user;
    } catch {
      setUser(null);
      setPermissions(new Set());
      return null;
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
    // anything that depends on it. This doubles as proof that the session cookie was
    // actually stored -- if it was not, this call comes back anonymous and reporting
    // success here would strand the user on the login screen with no explanation.
    const confirmed = await refreshUser();
    if (!confirmed) throw new SessionNotPersistedError();

    return confirmed;
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
