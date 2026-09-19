import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { RealtimePayload } from '@/types/domain';

/**
 * Socket connection for live updates.
 *
 * The handshake carries the same HttpOnly session cookie as the REST API (hence
 * `withCredentials`), so there is no token to store and a revoked session drops the
 * socket too.
 *
 * Events are debounced before being applied: a burst of changes -- someone adding
 * several expenses, or a reconnect replaying state -- collapses into one refetch per
 * region rather than a request storm.
 *
 * Returns whether the socket is currently connected, which the header renders as a live
 * indicator. When it is false the dashboard is still correct, just not live, so the
 * indicator is informational rather than an error.
 */
const DEBOUNCE_MS = 350;

export const useRealtime = (
  groupId: string | null,
  onEvent: (payload: RealtimePayload) => void,
  onReconnect?: () => void,
): { isConnected: boolean } => {
  const [isConnected, setIsConnected] = useState(false);

  // Kept in refs so re-renders do not tear down and rebuild the socket.
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const reconnectRef = useRef(onReconnect);
  reconnectRef.current = onReconnect;

  useEffect(() => {
    if (!groupId) {
      setIsConnected(false);
      return;
    }

    const socket: Socket = io({
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: RealtimePayload[] = [];

    const flush = () => {
      const batch = pending;
      pending = [];

      // Collapse duplicates so ten rapid edits to one expense cause one refetch.
      const seen = new Set<string>();
      for (const payload of batch) {
        const key = `${payload.event}:${payload.entityId ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        handlerRef.current(payload);
      }
    };

    const handleRealtime = (payload: RealtimePayload) => {
      if (payload.groupId !== groupId) return;
      pending.push(payload);
      clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    const subscribe = () => {
      // The server verifies membership before joining the room.
      socket.emit('group:subscribe', groupId);
    };

    socket.on('connect', () => {
      setIsConnected(true);
      subscribe();
    });

    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => setIsConnected(false));

    socket.io.on('reconnect', () => {
      subscribe();
      // State may have moved on while we were away, so resynchronise.
      reconnectRef.current?.();
    });

    socket.on('realtime', handleRealtime);

    return () => {
      clearTimeout(timer);
      socket.off('realtime', handleRealtime);
      if (socket.connected) socket.emit('group:unsubscribe', groupId);
      socket.disconnect();
      setIsConnected(false);
    };
  }, [groupId]);

  return { isConnected };
};
