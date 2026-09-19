import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { app, api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { closeRealtime, initRealtime } from '../src/realtime/socketServer.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import type { RealtimePayload } from '../src/realtime/events.js';

let httpServer: HttpServer;
let port: number;
const openSockets: ClientSocket[] = [];

beforeEach(async () => {
  await resetAll();
  httpServer = createServer(app);
  initRealtime(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as { port: number }).port;
      resolve();
    });
  });
});

afterEach(async () => {
  for (const socket of openSockets.splice(0)) socket.disconnect();
  await closeRealtime();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

afterAll(closeDatabase);

/** Connects a socket client carrying the given session cookie. */
const connect = (cookie: string): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
      reconnection: false,
    });
    openSockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (error) => reject(error));
  });

/** Resolves with the next `realtime` payload, or null if none arrives in time. */
const nextEvent = (socket: ClientSocket, timeoutMs = 1500): Promise<RealtimePayload | null> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off('realtime', handler);
      resolve(null);
    }, timeoutMs);
    const handler = (payload: RealtimePayload) => {
      clearTimeout(timer);
      socket.off('realtime', handler);
      resolve(payload);
    };
    socket.on('realtime', handler);
  });

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

/** Distinguishes people across multiple setup() calls within one test. */
let setupCounter = 0;

const setup = async (count = 2) => {
  const batch = setupCounter++;
  const people = [];
  for (let i = 0; i < count; i += 1) people.push(await member(`g${batch}user${i}`));

  const res = await api()
    .post('/api/groups')
    .set('Cookie', people[0]!.cookie)
    .send({ name: `Flat ${batch}` })
    .expect(201);

  const group = res.body.data.group as { id: string; inviteCode: string };
  for (let i = 1; i < count; i += 1) await joinGroupByInvite(group.inviteCode, people[i]!.userId);

  return { groupId: group.id, people };
};

const TODAY = new Date().toISOString().slice(0, 10);

/* ========================================================================== */

describe('socket authentication', () => {
  it('rejects a connection with no session cookie', async () => {
    await expect(connect('')).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it('rejects a forged session cookie', async () => {
    await expect(connect('sw_session=not-a-real-token')).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it('accepts a valid session cookie', async () => {
    const alice = await member('alice');
    const socket = await connect(alice.cookie);
    expect(socket.connected).toBe(true);
  });

  it('rejects a revoked session, unlike a stateless token', async () => {
    const alice = await member('alice');
    await api().post('/api/auth/logout').set('Cookie', alice.cookie).expect(200);

    // The same cookie that worked a moment ago is now dead for sockets too.
    await expect(connect(alice.cookie)).rejects.toThrow(/UNAUTHENTICATED/);
  });
});

describe('room isolation', () => {
  it('delivers group events to members', async () => {
    const { groupId, people } = await setup(2);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    const bobSocket = await connect(bob.cookie);
    const received = nextEvent(bobSocket);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', alice.cookie)
      .send({ title: 'Dinner', amount: 900, expenseDate: TODAY })
      .expect(201);

    const payload = await received;
    expect(payload).not.toBeNull();
    expect(payload!.event).toBe('expense:created');
    expect(payload!.groupId).toBe(groupId);
    expect(payload!.actorId).toBe(alice.userId);
    expect(payload!.message).toContain('Dinner');
  });

  it('never delivers a group\'s events to a non-member', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;
    const mallory = await member('mallory');

    const mallorySocket = await connect(mallory.cookie);
    const received = nextEvent(mallorySocket);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', alice.cookie)
      .send({ title: 'Secret dinner', amount: 900, expenseDate: TODAY })
      .expect(201);

    // Mallory is in no group, so nothing should reach her.
    expect(await received).toBeNull();
  });

  it('refuses a client-supplied room subscription for a group the user is not in', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;
    const mallory = await member('mallory');

    const mallorySocket = await connect(mallory.cookie);

    // The reference implementation joined whatever room id the client sent.
    const accepted = await new Promise<boolean>((resolve) => {
      mallorySocket.emit('group:subscribe', groupId, (ok: boolean) => resolve(ok));
      setTimeout(() => resolve(false), 1000);
    });
    expect(accepted).toBe(false);

    const received = nextEvent(mallorySocket);
    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', alice.cookie)
      .send({ title: 'Still secret', amount: 900, expenseDate: TODAY })
      .expect(201);

    expect(await received).toBeNull();
  });

  it('accepts a subscription to a group the user does belong to', async () => {
    const { groupId, people } = await setup(2);
    const bob = people[1]!;

    const bobSocket = await connect(bob.cookie);
    const accepted = await new Promise<boolean>((resolve) => {
      bobSocket.emit('group:subscribe', groupId, (ok: boolean) => resolve(ok));
      setTimeout(() => resolve(false), 1000);
    });
    expect(accepted).toBe(true);
  });

  it('isolates two different groups from each other', async () => {
    const a = await setup(2);
    const b = await setup(2);

    // A member of group B must not see group A's traffic.
    const bSocket = await connect(b.people[0]!.cookie);
    const received = nextEvent(bSocket);

    await api()
      .post(`/api/groups/${a.groupId}/expenses`)
      .set('Cookie', a.people[0]!.cookie)
      .send({ title: 'Group A dinner', amount: 900, expenseDate: TODAY })
      .expect(201);

    expect(await received).toBeNull();
  });
});

describe('targeted invalidation', () => {
  it('an expense change invalidates live, analytics and chart', async () => {
    const { groupId, people } = await setup(2);
    const bobSocket = await connect(people[1]!.cookie);
    const received = nextEvent(bobSocket);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Dinner', amount: 900, expenseDate: TODAY })
      .expect(201);

    const payload = await received;
    expect(payload!.regions.sort()).toEqual(['analytics', 'chart', 'live']);
  });

  it('a settlement invalidates only live, never the spending history', async () => {
    const { groupId, people } = await setup(2);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', alice.cookie)
      .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
      .expect(201);

    const aliceSocket = await connect(alice.cookie);
    const received = nextEvent(aliceSocket);

    await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 500, paymentMethod: 'cash' })
      .expect(201);

    const payload = await received;
    expect(payload!.event).toBe('settlement:created');
    // Settling changes what is owed, not what was spent.
    expect(payload!.regions).toEqual(['live']);
  });

  it('carries no financial figures in the payload', async () => {
    const { groupId, people } = await setup(2);
    const bobSocket = await connect(people[1]!.cookie);
    const received = nextEvent(bobSocket);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Dinner', amount: 900, expenseDate: TODAY })
      .expect(201);

    const payload = await received;
    // The socket says "this changed, ask again" -- it is never a second source of
    // financial truth that could drift from the database.
    expect(payload).not.toHaveProperty('amountPaise');
    expect(payload).not.toHaveProperty('balances');
    expect(Object.keys(payload!).sort()).toEqual([
      'actorId',
      'actorName',
      'entityId',
      'event',
      'groupId',
      'message',
      'regions',
      'timestamp',
    ]);
  });

  it('announces a new member to the existing group', async () => {
    const { groupId, people } = await setup(1);
    const alice = people[0]!;
    const bob = await member('bob');

    const share = await api()
      .get(`/api/groups/${groupId}/share`)
      .set('Cookie', alice.cookie)
      .expect(200);

    const aliceSocket = await connect(alice.cookie);
    const received = nextEvent(aliceSocket);

    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: share.body.data.inviteCode })
      .expect(201);

    const payload = await received;
    expect(payload!.event).toBe('group:member_joined');
    expect(payload!.actorId).toBe(bob.userId);
  });
});
