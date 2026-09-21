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
import { auth } from '@/api/endpoints';
import { clearStoredToken, loadStoredToken, onSessionLost } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { Permissions, User } from '@/api/types';

/**
 * Who is signed in, and how sure we are.
 *
 * `restoring`    we are still finding out. Nothing may be decided on this.
 * `authenticated` the server confirmed the session on this launch.
 * `anonymous`     there is no session, or the server said the one we had is dead.
 * `unreachable`   we hold a token but could not reach the server to confirm it.
 *
 * `unreachable` exists because the honest answer to "no network at launch" is not "you
 * are signed out". Collapsing it into `anonymous` would throw people back to the sign-in
 * screen every time they open the app on a train, and asking for a password is the one
 * thing we cannot do while offline anyway. So we say what is actually true and offer a
 * retry.
 *
 * The web client learned the matching lesson the hard way: rendering the signed-out view
 * while the answer is still in flight is what produces the login flash. Here that is
 * structural -- `restoring` is its own state, and no screen treats it as "signed out".
 */
export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous' | 'unreachable';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  permissions: Permissions;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-checks the session. Used by the reconnect screen and by pull-to-refresh. */
  refresh: () => Promise<void>;
  /** UX only. The server re-checks every permission on the request itself. */
  can: (permission: string) => boolean;
};

const SIGNED_OUT: AuthState = { status: 'anonymous', user: null, permissions: [] };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({
    status: 'restoring',
    user: null,
    permissions: [],
  });

  // Guards against a slow reply from a check we have already moved past -- signing in
  // while the launch check is still in flight, for instance.
  const attempt = useRef(0);

  const resolveSession = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const generation = ++attempt.current;
    const settle = (next: AuthState): void => {
      if (generation === attempt.current && !signal?.aborted) setState(next);
    };

    const token = await loadStoredToken();
    if (!token) {
      settle(SIGNED_OUT);
      return;
    }

    try {
      const session = await auth.me(signal);
      settle({ status: 'authenticated', user: session.user, permissions: session.permissions });
    } catch (error: unknown) {
      if (signal?.aborted) return;
      if (error instanceof ApiError) {
        // The server answered, and its answer was no. 401 means the session is dead; 403
        // means the account is disabled. Either way this token is finished, and the
        // client has already dropped it on the 401 path.
        await clearStoredToken();
        settle(SIGNED_OUT);
        return;
      }
      // Never reached the server. The token might still be perfectly good, so it stays.
      settle({ status: 'unreachable', user: null, permissions: [] });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void resolveSession(controller.signal);
    return () => controller.abort();
  }, [resolveSession]);

  /**
   * A 401 from any request anywhere -- the session revoked from another device, expired
   * mid-session, the account disabled -- moves the whole app at once. Without this, a
   * screen would show a permission error while the rest of the app still believed it was
   * signed in.
   */
  useEffect(
    () =>
      onSessionLost(() => {
        attempt.current += 1;
        setState(SIGNED_OUT);
      }),
    [],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const generation = ++attempt.current;
    const { user } = await auth.signIn(email, password);

    // Login returns the user but not their permissions, so we ask. If that second call
    // fails the sign-in still stands -- the session is real -- and we start with no
    // permissions, which only ever hides optional UI. `refresh` fills them in later.
    let permissions: Permissions;
    try {
      permissions = (await auth.me()).permissions;
    } catch {
      permissions = [];
    }

    if (generation === attempt.current) {
      setState({ status: 'authenticated', user, permissions });
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    attempt.current += 1;
    try {
      // Revokes the session server-side, so the token is dead everywhere rather than
      // just forgotten here.
      await auth.signOut();
    } catch {
      // Offline, or the session had already expired. The local session is going either
      // way; leaving someone stuck signed in because the network is down would be worse.
    }
    await clearStoredToken();
    setState(SIGNED_OUT);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await resolveSession();
  }, [resolveSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signOut,
      refresh,
      can: (permission: string) => state.permissions.includes(permission),
    }),
    [state, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
