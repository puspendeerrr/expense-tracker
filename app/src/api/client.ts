import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { runtime } from '@/constants/environment';
import { ApiError, ConfigurationError, NetworkError } from './errors';
import * as secureStore from '@/storage/secureStore';

/**
 * The one way this app talks to the server.
 *
 * WHY IT CARRIES THE COOKIE BY HAND
 *
 * The backend authenticates with an opaque HttpOnly cookie, `sw_session`, and reads it
 * from `req.cookies` only -- there is no bearer-token path to use instead. React Native
 * does keep a native cookie jar, but what it still holds after a cold start is not
 * something we can assert, and a session that quietly evaporates overnight is the worst
 * kind of bug to chase. So we do the one thing a browser will not let you do: read
 * `set-cookie` off the response, keep the token in the Android keystore, and send it
 * back on the next request.
 *
 * This is transport, not a second authentication system. The token is minted, validated,
 * rotated and revoked entirely by the server; nothing here inspects it or derives
 * anything from it, and a token the server has revoked is dead the moment it is used.
 */

/**
 * How this app identifies itself to the server.
 *
 * React Native's default is `okhttp/4.12.0`, which is useless twice over: it says nothing
 * about the app, and — because the server derives its "new device" signature from the user
 * agent — EVERY non-browser client collapses to the single signature "Unknown device".
 * That means the second phone to sign into an account would not be flagged as new, which
 * is precisely the alert that matters.
 *
 * It is user-visible: the Devices screen shows the signature the server derives from it,
 * so it reads "SplitMoney app on SM-M346B". The server's matcher was updated in step with
 * this string -- changing one without the other silently returns every phone to the
 * single signature "Unknown device".
 *
 * The model is included because it is what distinguishes two Android phones, and it is
 * stable: unlike a version string, it does not change under the user and re-alert on
 * every update. Nothing here identifies the hardware beyond the model name the user sees
 * in their own settings.
 */
const userAgent = ((): string => {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const os = Platform.OS === 'ios' ? 'iOS' : 'Android';
  const release = Device.osVersion ?? 'unknown';
  const model = Device.modelName ?? 'unknown';
  return 'SplitMoney/' + version + ' (' + os + ' ' + release + '; ' + model + ')';
})();

const SESSION_COOKIE = 'sw_session';
const SESSION_KEY = 'splitwise.session';
const DEFAULT_TIMEOUT_MS = 15_000;

/* -------------------------------------------------------------------------- */
/* Session token                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors what is in the keystore so a request can decide what to send without an extra
 * await. `undefined` means "not read yet", which is not the same as `null`, "no session".
 */
let cachedToken: string | null | undefined;

export const loadStoredToken = async (): Promise<string | null> => {
  if (cachedToken === undefined) cachedToken = await secureStore.getItem(SESSION_KEY);
  return cachedToken;
};

const storeToken = async (token: string): Promise<void> => {
  cachedToken = token;
  await secureStore.setItem(SESSION_KEY, token);
};

export const clearStoredToken = async (): Promise<void> => {
  cachedToken = null;
  await secureStore.removeItem(SESSION_KEY);
};

/* -------------------------------------------------------------------------- */
/* Session loss                                                               */
/* -------------------------------------------------------------------------- */

type Listener = () => void;
const sessionLostListeners = new Set<Listener>();

/**
 * Any 401, from any screen, means the session is gone -- expired, revoked from another
 * device, or the account disabled. Rather than have every caller handle that, the client
 * announces it once and the auth provider moves the whole app to the signed-out state.
 */
export const onSessionLost = (listener: Listener): (() => void) => {
  sessionLostListeners.add(listener);
  return () => {
    sessionLostListeners.delete(listener);
  };
};

const announceSessionLost = (): void => {
  for (const listener of sessionLostListeners) listener();
};

/* -------------------------------------------------------------------------- */
/* Cookie parsing                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Pulls `sw_session` out of a Set-Cookie header.
 *
 * `fetch` folds several Set-Cookie headers into one comma-joined string, which is
 * ambiguous in general because cookie expiry dates contain commas too. It is not
 * ambiguous for what we need: we anchor on the cookie's own name and stop at the first
 * `;` or `,`.
 *
 * An empty value is the server clearing the cookie, which it does on logout and whenever
 * it is shown a stale token. That is a signal rather than a token, so it is reported
 * separately from "no cookie in this response at all".
 */
const readSessionCookie = (header: string | null): string | null | undefined => {
  if (!header) return undefined;
  const match = header.match(/(?:^|[,\s])sw_session=([^;,\s]*)/);
  if (!match) return undefined;
  const value = match[1];
  return value && value !== 'null' ? decodeURIComponent(value) : null;
};

/* -------------------------------------------------------------------------- */
/* Request                                                                    */
/* -------------------------------------------------------------------------- */

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Sign-in and the health check send no cookie; everything else does. */
  anonymous?: boolean;
};

const baseUrl = (): string => {
  if (!runtime.api.url) {
    throw new ConfigurationError(
      'The API address is ' +
        runtime.api.status.toLowerCase() +
        '. Set EXPO_PUBLIC_API_URL in .env.local and restart Metro.',
    );
  }
  return runtime.api.url;
};

export const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const url = baseUrl() + path;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': userAgent,
  };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!options.anonymous) {
    const token = await loadStoredToken();
    if (token) headers.Cookie = SESSION_COOKIE + '=' + encodeURIComponent(token);
  }

  // A hung socket is the ordinary failure on a phone: the request is not refused, it
  // simply never completes. Without this the app would sit on a spinner for ever.
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortOuter = (): void => controller.abort();
  options.signal?.addEventListener('abort', abortOuter);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    // An abort we caused by timing out, one the caller asked for, and the radio being
    // off all arrive here, and they read very differently to someone holding the phone.
    if (options.signal?.aborted) throw error;
    const timedOut = controller.signal.aborted;
    throw new NetworkError(
      timedOut ? 'No response within ' + Math.round(timeoutMs / 1000) + 's' : 'Request failed',
      { timedOut, reason: error },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortOuter);
  }

  // Read before the status is checked, so the token handed back by a successful sign-in
  // is captured and the one cleared on sign-out is dropped.
  const cookie = readSessionCookie(response.headers.get('set-cookie'));
  if (cookie === null) await clearStoredToken();
  else if (cookie !== undefined && cookie !== cachedToken) await storeToken(cookie);

  let payload: unknown;
  try {
    payload = response.status === 204 ? { ok: true, data: {} } : await response.json();
  } catch (error: unknown) {
    // Usually means something answered that is not our API at all: a captive portal, or
    // a proxy's own error page.
    throw new NetworkError(
      'The server returned something we could not read (HTTP ' + response.status + ')',
      { reason: error },
    );
  }

  const envelope = payload as {
    ok?: boolean;
    data?: T;
    error?: { code?: string; message?: string; fields?: Record<string, string> };
  };

  if (!response.ok || envelope.ok !== true) {
    const error = new ApiError(
      response.status,
      envelope.error?.code ?? 'INTERNAL_ERROR',
      envelope.error?.message ?? 'Something went wrong. Please try again.',
      envelope.error?.fields,
    );
    if (error.isUnauthenticated) {
      await clearStoredToken();
      announceSessionLost();
    }
    throw error;
  }

  return envelope.data as T;
};
