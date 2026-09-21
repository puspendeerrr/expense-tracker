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
import { io, type Socket } from 'socket.io-client';
import { loadStoredToken } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { runtime } from '@/constants/environment';

/**
 * Realtime updates over the same Socket.IO server the web client uses.
 *
 * AUTHENTICATION
 * The server's handshake middleware reads `sw_session` from the handshake's Cookie
 * header and resolves it exactly like a REST request. A browser attaches that cookie on
 * its own; React Native does not, so the token is taken from the same keystore the API
 * client uses and passed through `extraHeaders`. No second auth scheme, no token in a
 * query string where it would end up in server logs.
 *
 * `extraHeaders` only applies to HTTP polling, so the transport is pinned to polling for
 * the handshake and allowed to upgrade to WebSocket afterwards, which is the documented
 * way to authenticate a non-browser client by header.
 *
 * THE WIRE FORMAT
 * The server emits ONE socket event, `realtime`, whose payload names what happened. It
 * does not emit `expense:created` and friends as socket events — those strings are values
 * of `payload.event`. This was got wrong once here and cost nothing only because it was
 * caught by actually subscribing and creating an expense: everything looked connected,
 * and no event ever arrived. The web client listens the same way.
 *
 * WHAT IT IS FOR
 * Events carry no data worth trusting — they are a nudge to refetch, nothing more. Every
 * figure still comes from the API, so a forged or stale event can at worst cause an
 * unnecessary request. Balances are never patched locally from a socket payload.
 */

type EventName =
  | 'expense:created'
  | 'expense:updated'
  | 'expense:deleted'
  | 'settlement:created'
  | 'settlement:approved'
  | 'settlement:rejected'
  | 'settlement:cancelled'
  | 'settlement:proof_updated'
  | 'group:member_joined'
  | 'group:member_left'
  | 'group:member_removed'
  | 'group:updated'
  | 'group:invite_regenerated';

/** The single channel the server publishes on. */
const CHANNEL = 'realtime';

/** Mirrors the server's `RealtimePayload`. */
export type RealtimeMessage = {
  event: EventName;
  groupId: string;
  /** Who caused it, so a screen can skip reacting to its own action. */
  actorId: string;
  actorName: string;
  entityId?: string;
  message: string;
  regions: ('live' | 'analytics' | 'chart')[];
  timestamp: string;
};

type Listener = (message: RealtimeMessage) => void;

type SocketContextValue = {
  connected: boolean;
  /** Joins a group's room and leaves it on cleanup. Safe to call from several screens. */
  subscribe: (groupId: string) => () => void;
  /** Called for every event. Filter by `groupId` in the handler. */
  addListener: (listener: Listener) => () => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

/** Socket.IO attaches to the server root, not under `/api`, so that suffix is removed. */
const socketOrigin = (): string | null => {
  if (!runtime.api.url) return null;
  return runtime.api.url.replace(/\/api\/?$/, '');
};

export function SocketProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef(new Set<Listener>());
  /** Rooms wanted right now, with a count so two screens can want the same one. */
  const roomsRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (status !== 'authenticated') return;

    const origin = socketOrigin();
    if (!origin) return;

    let cancelled = false;
    let socket: Socket | null = null;

    void (async () => {
      const token = await loadStoredToken();
      if (cancelled || !token) return;

      socket = io(origin, {
        // Polling first so `extraHeaders` is actually sent; it then upgrades.
        transports: ['polling', 'websocket'],
        extraHeaders: { Cookie: 'sw_session=' + encodeURIComponent(token) },
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 10_000,
        timeout: 15_000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        // Rejoin on every connect, not just the first: a reconnection is a new socket
        // server-side, and its room membership starts empty.
        for (const groupId of roomsRef.current.keys()) socket?.emit('group:subscribe', groupId);
      });

      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', () => setConnected(false));

      socket.on(CHANNEL, (payload: RealtimeMessage) => {
        for (const listener of listenersRef.current) listener(payload);
      });
    })();

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // Reconnects with a fresh token whenever the signed-in identity changes.
  }, [status]);

  const subscribe = useCallback((groupId: string) => {
    const next = (roomsRef.current.get(groupId) ?? 0) + 1;
    roomsRef.current.set(groupId, next);
    if (next === 1) socketRef.current?.emit('group:subscribe', groupId);

    return () => {
      const remaining = (roomsRef.current.get(groupId) ?? 1) - 1;
      if (remaining > 0) {
        roomsRef.current.set(groupId, remaining);
        return;
      }
      roomsRef.current.delete(groupId);
      socketRef.current?.emit('group:unsubscribe', groupId);
    };
  }, []);

  const addListener = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo<SocketContextValue>(
    () => ({ connected, subscribe, addListener }),
    [connected, subscribe, addListener],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const value = useContext(SocketContext);
  if (!value) throw new Error('useSocket requires SocketProvider');
  return value;
}

/**
 * Subscribes to a group and runs `onEvent` for events belonging to it.
 *
 * `onEvent` is held in a ref so a caller can pass an inline arrow without the
 * subscription tearing down and rebuilding on every render.
 */
export function useGroupRealtime(
  groupId: string | undefined,
  onEvent: (message: RealtimeMessage) => void,
): void {
  const { subscribe, addListener } = useSocket();
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!groupId) return;
    const leave = subscribe(groupId);
    const stop = addListener((message) => {
      if (!message.groupId || message.groupId === groupId) handler.current(message);
    });
    return () => {
      stop();
      leave();
    };
  }, [groupId, subscribe, addListener]);
}
