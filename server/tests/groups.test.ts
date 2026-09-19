import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { groupMembers, groups, users } from '../src/db/schema.js';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import {
  generateInviteCode,
  generateInviteToken,
  isPlausibleInviteCode,
  normalizeInviteCode,
} from '../src/services/inviteCodeService.js';
import { createGroup, joinGroupByInvite } from '../src/services/groupService.js';
import { createExpense } from '../src/services/expenseService.js';
import { rupeesToPaise } from '../src/utils/money.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

/** Signs a user up through the real HTTP flow and returns their cookie + id. */
const member = async (name: string) => {
  const email = `${name}@example.com`;
  const { cookie, userId } = await signupUser(email, undefined, name);
  return { cookie, userId, email };
};

const createGroupViaApi = async (cookie: string, name = 'Flat 402') => {
  const res = await api()
    .post('/api/groups')
    .set('Cookie', cookie)
    .send({ name })
    .expect(201);
  return res.body.data.group as { id: string; inviteCode: string; role: string };
};

const shareInfo = async (cookie: string, groupId: string) => {
  const res = await api().get(`/api/groups/${groupId}/share`).set('Cookie', cookie).expect(200);
  return res.body.data as {
    inviteCode: string;
    inviteToken: string;
    invitePath: string;
    isCreator: boolean;
  };
};

/* ========================================================================== */
/* Invite code generation                                                     */
/* ========================================================================== */

describe('invite code generation', () => {
  it('produces 6-character codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[234567892ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
      // Characters people misread must never appear.
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('is not obviously biased or repeating', () => {
    const codes = new Set(Array.from({ length: 2000 }, generateInviteCode));
    // 30^6 space; 2000 draws should essentially never collide.
    expect(codes.size).toBeGreaterThan(1990);
  });

  it('produces high-entropy, unique share tokens', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateInviteToken));
    expect(tokens.size).toBe(1000);
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it('normalizes user-typed codes', () => {
    expect(normalizeInviteCode('  abc-234 ')).toBe('ABC234');
    expect(normalizeInviteCode('ab c23 4')).toBe('ABC234');
    expect(isPlausibleInviteCode('ABC234')).toBe(true);
    expect(isPlausibleInviteCode('ABC01I')).toBe(false); // ambiguous chars
    expect(isPlausibleInviteCode('ABC23')).toBe(false); // too short
  });
});

/* ========================================================================== */
/* Group creation                                                             */
/* ========================================================================== */

describe('group creation', () => {
  it('creates the group, creator membership and audit entry atomically', async () => {
    const alice = await member('alice');
    const group = await createGroupViaApi(alice.cookie);

    expect(group.role).toBe('creator');
    expect(group.inviteCode).toMatch(/^[A-Z0-9]{6}$/);

    const memberships = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.role).toBe('creator');

    const activity = await db.query.activities.findMany({
      where: (a, { eq: e }) => e(a.groupId, group.id),
    });
    expect(activity.map((a) => a.type)).toContain('group_created');
  });

  it('rejects an unauthenticated creator', async () => {
    await api().post('/api/groups').send({ name: 'Nope' }).expect(401);
  });

  it('validates the group name', async () => {
    const alice = await member('alice');
    const res = await api()
      .post('/api/groups')
      .set('Cookie', alice.cookie)
      .send({ name: 'x' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows a user to create and belong to multiple groups', async () => {
    const alice = await member('alice');
    await createGroupViaApi(alice.cookie, 'Flat 402');
    await createGroupViaApi(alice.cookie, 'Goa Trip');

    const res = await api().get('/api/groups').set('Cookie', alice.cookie).expect(200);
    expect(res.body.data.groups).toHaveLength(2);
  });

  it('issues unique codes under concurrent creation', async () => {
    const alice = await member('alice');

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        api().post('/api/groups').set('Cookie', alice.cookie).send({ name: `Group ${i}` }),
      ),
    );

    const codes = results.map((r) => r.body.data.group.inviteCode as string);
    expect(results.every((r) => r.status === 201)).toBe(true);
    // The UNIQUE index is the real guarantee; this proves no duplicate escaped.
    expect(new Set(codes).size).toBe(codes.length);
  });
});

/* ========================================================================== */
/* Joining                                                                    */
/* ========================================================================== */

describe('joining a group', () => {
  it('joins with a human invite code', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);

    const res = await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: group.inviteCode })
      .expect(201);

    expect(res.body.data.group.id).toBe(group.id);
    expect(res.body.data.group.role).toBe('member');
    expect(res.body.data.alreadyMember).toBe(false);
  });

  it('accepts a lower-cased and hyphenated code', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);

    const messy = `${group.inviteCode.slice(0, 3)}-${group.inviteCode.slice(3)}`.toLowerCase();
    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: messy })
      .expect(201);
  });

  it('joins with the opaque share token', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    const share = await shareInfo(alice.cookie, group.id);

    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: share.inviteToken })
      .expect(201);
  });

  it('joins from a pasted invite URL (QR scan payload)', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    const share = await shareInfo(alice.cookie, group.id);

    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: `https://splitwise.example.com/join/${share.inviteToken}?src=qr` })
      .expect(201);
  });

  it('rejects an invalid code', async () => {
    const bob = await member('bob');
    const res = await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: 'ZZZZZZ' })
      .expect(404);
    expect(res.body.error.code).toBe('INVITE_INVALID');
  });

  it('rejects an unauthenticated join', async () => {
    const alice = await member('alice');
    const group = await createGroupViaApi(alice.cookie);
    await api().post('/api/groups/join').send({ invite: group.inviteCode }).expect(401);
  });

  it('treats re-joining as a no-op rather than an error', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);

    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: group.inviteCode })
      .expect(201);

    const again = await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: group.inviteCode })
      .expect(200);

    expect(again.body.data.alreadyMember).toBe(true);

    const memberships = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    expect(memberships).toHaveLength(2);
  });

  it('the creator re-joining their own group changes nothing', async () => {
    const alice = await member('alice');
    const group = await createGroupViaApi(alice.cookie);

    const res = await api()
      .post('/api/groups/join')
      .set('Cookie', alice.cookie)
      .send({ invite: group.inviteCode })
      .expect(200);

    expect(res.body.data.alreadyMember).toBe(true);
    expect(res.body.data.group.role).toBe('creator'); // not demoted to member

    const memberships = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    expect(memberships).toHaveLength(1);
  });

  it('creates exactly one membership under concurrent joins', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        api().post('/api/groups/join').set('Cookie', bob.cookie).send({ invite: group.inviteCode }),
      ),
    );

    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);

    const memberships = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    // UNIQUE(group_id, user_id) is what makes this true, not a check-then-insert.
    expect(memberships).toHaveLength(2);
  });
});

/* ========================================================================== */
/* Invite preview + revocation                                                */
/* ========================================================================== */

describe('invite preview', () => {
  it('previews a group anonymously without leaking secrets', async () => {
    const alice = await member('alice');
    const group = await createGroupViaApi(alice.cookie);

    const res = await api().get(`/api/groups/invite/${group.inviteCode}/preview`).expect(200);

    expect(res.body.data.groupName).toBe('Flat 402');
    expect(res.body.data.memberCount).toBe(1);
    expect(res.body.data.isAlreadyMember).toBe(false);
    // The token must never appear in an unauthenticated response.
    expect(JSON.stringify(res.body)).not.toContain('inviteToken');
  });

  it('tells a signed-in existing member that they already belong', async () => {
    const alice = await member('alice');
    const group = await createGroupViaApi(alice.cookie);

    const res = await api()
      .get(`/api/groups/invite/${group.inviteCode}/preview`)
      .set('Cookie', alice.cookie)
      .expect(200);

    expect(res.body.data.isAlreadyMember).toBe(true);
  });

  it('404s an unknown invite', async () => {
    const res = await api().get('/api/groups/invite/ZZZZZZ/preview').expect(404);
    expect(res.body.error.code).toBe('INVITE_INVALID');
  });
});

describe('invite regeneration revokes the old invite', () => {
  it('invalidates both the previous code and the previous token', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    const before = await shareInfo(alice.cookie, group.id);

    const res = await api()
      .post(`/api/groups/${group.id}/invite/regenerate`)
      .set('Cookie', alice.cookie)
      .expect(200);

    const after = res.body.data as { inviteCode: string; inviteToken: string };
    expect(after.inviteCode).not.toBe(before.inviteCode);
    expect(after.inviteToken).not.toBe(before.inviteToken);

    // Old credentials are dead.
    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: before.inviteCode })
      .expect(404);

    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: before.inviteToken })
      .expect(404);

    // New credential works.
    await api()
      .post('/api/groups/join')
      .set('Cookie', bob.cookie)
      .send({ invite: after.inviteCode })
      .expect(201);
  });

  it('is creator-only', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    const res = await api()
      .post(`/api/groups/${group.id}/invite/regenerate`)
      .set('Cookie', bob.cookie)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

/* ========================================================================== */
/* Access control                                                             */
/* ========================================================================== */

describe('group access control', () => {
  it('hides a group from a non-member as 404, not 403', async () => {
    const alice = await member('alice');
    const mallory = await member('mallory');
    const group = await createGroupViaApi(alice.cookie);

    // 403 would confirm the group exists, enabling enumeration.
    const res = await api().get(`/api/groups/${group.id}`).set('Cookie', mallory.cookie).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('refuses to expose the share token to a non-member', async () => {
    const alice = await member('alice');
    const mallory = await member('mallory');
    const group = await createGroupViaApi(alice.cookie);

    await api().get(`/api/groups/${group.id}/share`).set('Cookie', mallory.cookie).expect(404);
  });

  it('rejects a malformed group id cleanly', async () => {
    const alice = await member('alice');
    await api().get('/api/groups/not-a-uuid').set('Cookie', alice.cookie).expect(404);
  });

  it('never trusts a client-supplied groupId in the body', async () => {
    const alice = await member('alice');
    const mallory = await member('mallory');
    const group = await createGroupViaApi(alice.cookie);

    // Mallory owns this group; the path id belongs to Alice.
    const mallorysGroup = await createGroupViaApi(mallory.cookie, 'Mallory Group');

    const res = await api()
      .patch(`/api/groups/${group.id}`)
      .set('Cookie', mallory.cookie)
      .send({ name: 'Hijacked', groupId: mallorysGroup.id })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');

    const unchanged = await db.select().from(groups).where(eq(groups.id, group.id));
    expect(unchanged[0]!.name).toBe('Flat 402');
  });
});

/* ========================================================================== */
/* Leaving, removal, deletion, creator transfer                               */
/* ========================================================================== */

describe('leaving a group', () => {
  it('lets a settled member leave', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    const res = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Cookie', bob.cookie)
      .expect(200);

    expect(res.body.data.groupDeleted).toBe(false);

    const memberships = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    expect(memberships).toHaveLength(1);
  });

  it('blocks leaving while money is owed, computed server-side', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    await createExpense({
      groupId: group.id,
      actorUserId: alice.userId,
      title: 'Dinner',
      amountPaise: rupeesToPaise(1000)!,
      paidBy: alice.userId,
      splitType: 'everyone',
      paymentMode: 'cash',
      expenseDate: TODAY,
    });

    // Debtor cannot leave.
    const debtor = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Cookie', bob.cookie)
      .expect(400);
    expect(debtor.body.error.code).toBe('OUTSTANDING_BALANCE');
    expect(debtor.body.error.details.youNeedToPayPaise).toBe(50000);

    // Creditor cannot leave either — they would abandon a receivable.
    const creditor = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Cookie', alice.cookie)
      .expect(400);
    expect(creditor.body.error.code).toBe('OUTSTANDING_BALANCE');
  });

  it('transfers creator to the longest-standing member', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const carol = await member('carol');
    const group = await createGroupViaApi(alice.cookie);

    await joinGroupByInvite(group.inviteCode, bob.userId);
    await joinGroupByInvite(group.inviteCode, carol.userId);

    await api().post(`/api/groups/${group.id}/leave`).set('Cookie', alice.cookie).expect(200);

    const remaining = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));

    const creators = remaining.filter((m) => m.role === 'creator');
    expect(creators).toHaveLength(1);
    // Bob joined before Carol, so Bob inherits — not an arbitrary row.
    expect(creators[0]!.userId).toBe(bob.userId);
  });

  it('deletes the group when the last member leaves', async () => {
    const alice = await member('alice');
    const group = await createGroupViaApi(alice.cookie);

    const res = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Cookie', alice.cookie)
      .expect(200);

    expect(res.body.data.groupDeleted).toBe(true);
    expect(await db.select().from(groups).where(eq(groups.id, group.id))).toHaveLength(0);
  });
});

describe('member removal and group deletion', () => {
  it('lets the creator remove a settled member', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    await api()
      .delete(`/api/groups/${group.id}/members/${bob.userId}`)
      .set('Cookie', alice.cookie)
      .expect(200);

    const memberships = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    expect(memberships).toHaveLength(1);
  });

  it('refuses to remove a member with outstanding balances', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    await createExpense({
      groupId: group.id,
      actorUserId: alice.userId,
      title: 'Dinner',
      amountPaise: rupeesToPaise(500)!,
      paidBy: alice.userId,
      splitType: 'everyone',
      paymentMode: 'cash',
      expenseDate: TODAY,
    });

    const res = await api()
      .delete(`/api/groups/${group.id}/members/${bob.userId}`)
      .set('Cookie', alice.cookie)
      .expect(400);
    expect(res.body.error.code).toBe('OUTSTANDING_BALANCE');
  });

  it('does not let a member remove anyone', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    await api()
      .delete(`/api/groups/${group.id}/members/${alice.userId}`)
      .set('Cookie', bob.cookie)
      .expect(403);
  });

  it('deletes the group and cascades its records', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    await createExpense({
      groupId: group.id,
      actorUserId: alice.userId,
      title: 'Dinner',
      amountPaise: rupeesToPaise(500)!,
      paidBy: alice.userId,
      splitType: 'everyone',
      paymentMode: 'cash',
      expenseDate: TODAY,
    });

    await api().delete(`/api/groups/${group.id}`).set('Cookie', alice.cookie).expect(200);

    expect(await db.select().from(groups).where(eq(groups.id, group.id))).toHaveLength(0);
    expect(
      await db.select().from(groupMembers).where(eq(groupMembers.groupId, group.id)),
    ).toHaveLength(0);
    // Users themselves must survive their group being deleted.
    expect((await db.select().from(users)).length).toBeGreaterThanOrEqual(2);
  });

  it('is creator-only', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    await api().delete(`/api/groups/${group.id}`).set('Cookie', bob.cookie).expect(403);
  });
});

/* ========================================================================== */
/* Group detail + payday                                                      */
/* ========================================================================== */

describe('group detail', () => {
  it('returns members with live balance totals', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    await createExpense({
      groupId: group.id,
      actorUserId: alice.userId,
      title: 'Groceries',
      amountPaise: rupeesToPaise(1000)!,
      paidBy: alice.userId,
      splitType: 'everyone',
      paymentMode: 'cash',
      expenseDate: TODAY,
    });

    const res = await api().get(`/api/groups/${group.id}`).set('Cookie', alice.cookie).expect(200);

    const members = res.body.data.members as {
      id: string;
      owesPaise: number;
      receivesPaise: number;
    }[];

    const aliceRow = members.find((m) => m.id === alice.userId)!;
    const bobRow = members.find((m) => m.id === bob.userId)!;

    expect(aliceRow.receivesPaise).toBe(50000);
    expect(aliceRow.owesPaise).toBe(0);
    expect(bobRow.owesPaise).toBe(50000);
    expect(bobRow.receivesPaise).toBe(0);
  });

  it('sets and clears the payday, creator-only', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);
    await joinGroupByInvite(group.inviteCode, bob.userId);

    const set = await api()
      .patch(`/api/groups/${group.id}/payday`)
      .set('Cookie', alice.cookie)
      .send({ payday: 5 })
      .expect(200);
    expect(set.body.data.group.payday).toBe(5);
    expect(set.body.data.billingCycle.payday).toBe(5);
    expect(set.body.data.billingCycle.nextPayday).toMatch(/^\d{4}-\d{2}-05$/);

    await api()
      .patch(`/api/groups/${group.id}/payday`)
      .set('Cookie', alice.cookie)
      .send({ payday: 32 })
      .expect(400);

    await api()
      .patch(`/api/groups/${group.id}/payday`)
      .set('Cookie', bob.cookie)
      .send({ payday: 10 })
      .expect(403);

    const cleared = await api()
      .patch(`/api/groups/${group.id}/payday`)
      .set('Cookie', alice.cookie)
      .send({ payday: null })
      .expect(200);
    expect(cleared.body.data.group.payday).toBeNull();
  });
});

/* ========================================================================== */
/* Service-level concurrency                                                  */
/* ========================================================================== */

describe('service-level invite races', () => {
  it('survives many groups created in parallel by different users', async () => {
    const userIds = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const inserted = await db
          .insert(users)
          .values({
            fullName: `Racer ${i}`,
            email: `racer${i}@test.local`,
            passwordHash: 'x',
            emailVerifiedAt: new Date(),
          })
          .returning({ id: users.id });
        return inserted[0]!.id;
      }),
    );

    const created = await Promise.all(
      userIds.map((userId) => createGroup({ name: 'Race', userId })),
    );

    const codes = created.map((c) => c.group.inviteCode);
    const tokens = created.map((c) => c.group.inviteToken);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});

/* ========================================================================== */
/* Regression: Drizzle error wrapping                                         */
/* ========================================================================== */

describe('unique-violation detection survives Drizzle error wrapping', () => {
  it('recovers a losing concurrent membership insert instead of 500ing', async () => {
    const alice = await member('alice');
    const bob = await member('bob');
    const group = await createGroupViaApi(alice.cookie);

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        api().post('/api/groups/join').set('Cookie', bob.cookie).send({ invite: group.inviteCode }),
      ),
    );

    // Drizzle hangs the driver error off `cause`; a naive `error.code` check misses it
    // and every loser of the race becomes a 500.
    expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });

  it('detects a unique violation through the wrapper', async () => {
    const { isUniqueViolation } = await import('../src/utils/dbErrors.js');

    const driverError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'group_members_group_user_unique',
    });
    const wrapped = Object.assign(new Error('Failed query: insert ...'), { cause: driverError });

    expect(isUniqueViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(wrapped, 'group_members_group_user_unique')).toBe(true);
    expect(isUniqueViolation(wrapped, 'some_other_constraint')).toBe(false);
    expect(isUniqueViolation(new Error('unrelated'))).toBe(false);
  });
});
