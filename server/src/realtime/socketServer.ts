import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { parseCookie } from 'cookie';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { groupMembers } from '../db/schema.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { SESSION_COOKIE, resolveSession } from '../services/sessionService.js';
import { buildPayload, type RealtimeEvent, type RealtimePayload } from './events.js';

/**
 * Realtime server.
 *
 * Two properties matter here, and both were broken in the reference implementation:
 *
 * 1. AUTHENTICATION reuses the same HttpOnly session cookie as the REST API, so a
 *    revoked session immediately loses its socket too. The reference authenticated
 *    sockets with a localStorage JWT, which could not be revoked.
 *
 * 2. ROOM MEMBERSHIP IS PROVEN SERVER-SIDE. The reference exposed a `join-group` event
 *    that joined whatever room id the client sent, letting any authenticated user
 *    subscribe to any group's live financial events. Here every room join is checked
 *    against `group_members` first.
 */

let io: Server | null = null;

const roomFor = (groupId: string): string => `group:${groupId}`;

type AuthedSocket = Socket & { userId?: string; userName?: string };

const isMember = async (groupId: string, userId: string): Promise<boolean> => {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return Boolean(rows[0]);
};

/** Joins the socket to every group the user currently belongs to. */
const joinAllGroups = async (socket: AuthedSocket, userId: string): Promise<string[]> => {
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const joined: string[] = [];
  for (const row of rows) {
    socket.join(roomFor(row.groupId));
    joined.push(row.groupId);
  }
  return joined;
};

export const initRealtime = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGINS,
      // Required for the session cookie to be sent with the handshake.
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  io.use(async (socket: AuthedSocket, next) => {
    try {
      const header = socket.handshake.headers.cookie;
      if (!header) return next(new Error('UNAUTHENTICATED'));

      const token = parseCookie(header)[SESSION_COOKIE];
      if (!token) return next(new Error('UNAUTHENTICATED'));

      const resolved = await resolveSession(token);
      if (!resolved) return next(new Error('UNAUTHENTICATED'));

      socket.userId = resolved.user.id;
      socket.userName = resolved.user.fullName;
      return next();
    } catch (error: unknown) {
      logger.warn('socket.auth_failed', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.userId!;

    /*
     * Listeners are registered SYNCHRONOUSLY, before any await.
     *
     * A client typically emits `group:subscribe` the instant it connects. If this
     * handler awaited the initial room join first, those early events would arrive
     * before the listener existed and be silently dropped.
     */
    socket.on('group:subscribe', async (groupId: unknown, ack?: (ok: boolean) => void) => {
      try {
        if (typeof groupId !== 'string' || !groupId) {
          ack?.(false);
          return;
        }

        // The id is untrusted: membership is proven before the room is joined.
        if (!(await isMember(groupId, userId))) {
          logger.warn('socket.subscribe_denied', { userId, groupId });
          ack?.(false);
          return;
        }

        socket.join(roomFor(groupId));
        ack?.(true);
      } catch (error: unknown) {
        // Always answer the ack; a silent failure would hang the client's promise.
        logger.error('socket.subscribe_failed', {
          userId,
          reason: error instanceof Error ? error.message : 'unknown',
        });
        ack?.(false);
      }
    });

    socket.on('group:unsubscribe', (groupId: unknown) => {
      if (typeof groupId === 'string' && groupId) socket.leave(roomFor(groupId));
    });

    socket.on('disconnect', (reason) => {
      logger.info('socket.disconnected', { userId, reason });
    });

    // Now the (async) initial subscription to everything the user already belongs to.
    joinAllGroups(socket, userId)
      .then((groups) => {
        logger.info('socket.connected', { userId, groupCount: groups.length });
        socket.emit('ready', { groupIds: groups });
      })
      .catch((error: unknown) => {
        logger.error('socket.join_failed', {
          userId,
          reason: error instanceof Error ? error.message : 'unknown',
        });
      });
  });

  logger.info('socket.initialized', {});
  return io;
};

export const getIo = (): Server | null => io;

/**
 * Publishes to a group room.
 *
 * A no-op when realtime is not initialised, so the REST API and the whole test suite
 * work unchanged without a socket server running.
 */
export const publishToGroup = (
  input: {
    event: RealtimeEvent;
    groupId: string;
    actorId: string;
    actorName: string;
    entityId?: string;
    message: string;
  },
): RealtimePayload => {
  const payload = buildPayload(input);
  io?.to(roomFor(input.groupId)).emit('realtime', payload);
  return payload;
};

/** Closes the server; used on shutdown. */
export const closeRealtime = async (): Promise<void> => {
  if (!io) return;
  await io.close();
  io = null;
};
