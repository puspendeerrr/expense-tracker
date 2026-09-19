import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import { createExpense } from '../src/services/expenseService.js';
import { rupeesToPaise } from '../src/utils/money.js';

/**
 * Global search.
 *
 * The feature is one predicate -- results are limited to the caller's own groups -- so
 * most of these tests are the same question asked from the outside: can a term that
 * exactly matches someone else's data pull it into my results? Every branch is asked
 * separately, because the scope is applied per query and an omission in one would not
 * show up in the others.
 */

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

const person = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId, name };
};

const makeGroup = async (cookie: string, name: string) => {
  const res = await api().post('/api/groups').set('Cookie', cookie).send({ name }).expect(201);
  return res.body.data.group as { id: string; inviteCode: string };
};

const spend = (groupId: string, paidBy: string, title: string, rupees = 500) =>
  createExpense({
    groupId,
    actorUserId: paidBy,
    title,
    amountPaise: rupeesToPaise(rupees)!,
    paidBy,
    splitType: 'everyone',
    paymentMode: 'cash',
    expenseDate: TODAY,
    notes: '',
  });

const find = async (cookie: string, q: string) => {
  const res = await api()
    .get(`/api/search?q=${encodeURIComponent(q)}`)
    .set('Cookie', cookie)
    .expect(200);
  return res.body.data as {
    groups: { id: string; name: string }[];
    members: { id: string; fullName: string }[];
    expenses: { id: string; title: string }[];
    settlements: { id: string }[];
    activity: { id: string }[];
  };
};

/**
 * Two accounts, each with their own private group, plus one they share.
 *
 * The distinct names make it unambiguous which side any result came from.
 */
const world = async () => {
  const mine = await person('mine');
  const theirs = await person('theirs');

  const shared = await makeGroup(mine.cookie, 'Shared Zebra');
  await joinGroupByInvite(shared.inviteCode, theirs.userId);

  const privateToThem = await makeGroup(theirs.cookie, 'Secret Zebra');

  await spend(shared.id, mine.userId, 'Zebra shared dinner');
  await spend(privateToThem.id, theirs.userId, 'Zebra secret dinner');

  return { mine, theirs, shared, privateToThem };
};

/* ========================================================================== */
/* Scope                                                                      */
/* ========================================================================== */

describe('search scope', () => {
  it('finds a group the caller belongs to', async () => {
    const { mine } = await world();
    const results = await find(mine.cookie, 'Zebra');

    expect(results.groups.map((g) => g.name)).toContain('Shared Zebra');
  });

  it('never returns a group the caller is not in', async () => {
    const { mine } = await world();
    const results = await find(mine.cookie, 'Zebra');

    expect(results.groups.map((g) => g.name)).not.toContain('Secret Zebra');
  });

  it('never returns an expense from a group the caller is not in', async () => {
    const { mine } = await world();
    const results = await find(mine.cookie, 'Zebra');

    const titles = results.expenses.map((e) => e.title);
    expect(titles).toContain('Zebra shared dinner');
    expect(titles).not.toContain('Zebra secret dinner');
  });

  it('only finds people who share a group with the caller', async () => {
    const { mine, theirs } = await world();
    const stranger = await person('stranger');
    await makeGroup(stranger.cookie, 'Lonely');

    const results = await find(mine.cookie, 'example.com');
    const ids = results.members.map((m) => m.id);

    expect(ids).toContain(theirs.userId);
    expect(ids).not.toContain(stranger.userId);
  });

  it('never returns the caller themselves as a person', async () => {
    const { mine } = await world();
    const results = await find(mine.cookie, 'mine');
    expect(results.members.map((m) => m.id)).not.toContain(mine.userId);
  });

  it('lists a person once however many groups are shared', async () => {
    const { mine, theirs, shared } = await world();

    const second = await makeGroup(mine.cookie, 'Second Zebra');
    await joinGroupByInvite(second.inviteCode, theirs.userId);
    expect(shared.id).not.toBe(second.id);

    const results = await find(mine.cookie, 'theirs');
    expect(results.members.filter((m) => m.id === theirs.userId)).toHaveLength(1);
  });

  it('stops returning a group once the caller leaves it', async () => {
    const { mine, theirs } = await world();

    /*
     * A group with no expenses in it.
     *
     * Leaving is refused while you still owe or are owed money, which is the right
     * product rule and would otherwise make this test about that rule rather than
     * about search scope.
     */
    const casual = await makeGroup(mine.cookie, 'Casual Zebra');
    await joinGroupByInvite(casual.inviteCode, theirs.userId);

    const before = await find(theirs.cookie, 'Casual');
    expect(before.groups.map((g) => g.name)).toContain('Casual Zebra');

    await api()
      .post(`/api/groups/${casual.id}/leave`)
      .set('Cookie', theirs.cookie)
      .expect(200);

    const after = await find(theirs.cookie, 'Casual');
    expect(after.groups.map((g) => g.name)).not.toContain('Casual Zebra');
  });
});

/* ========================================================================== */
/* Behaviour                                                                  */
/* ========================================================================== */

describe('search behaviour', () => {
  it('matches case-insensitively and on a partial word', async () => {
    const { mine } = await world();

    const lower = await find(mine.cookie, 'zebra sha');
    expect(lower.expenses.map((e) => e.title)).toContain('Zebra shared dinner');
  });

  it('treats a percent sign as a literal, not a wildcard', async () => {
    const { mine, shared } = await world();
    await spend(shared.id, mine.userId, '100% cotton towels');

    const literal = await find(mine.cookie, '100%');
    expect(literal.expenses.map((e) => e.title)).toContain('100% cotton towels');

    // A bare wildcard must not match everything.
    const wildcard = await find(mine.cookie, '%%');
    expect(wildcard.expenses).toHaveLength(0);
  });

  it('returns empty arrays rather than failing when nothing matches', async () => {
    const { mine } = await world();
    const results = await find(mine.cookie, 'zzzznothinghere');

    expect(results.groups).toHaveLength(0);
    expect(results.members).toHaveLength(0);
    expect(results.expenses).toHaveLength(0);
    expect(results.settlements).toHaveLength(0);
    expect(results.activity).toHaveLength(0);
  });

  it('caps each type independently', async () => {
    const { mine, shared } = await world();
    for (let i = 0; i < 9; i += 1) await spend(shared.id, mine.userId, `Zebra item ${i}`);

    const res = await api()
      .get('/api/search?q=Zebra&limit=3')
      .set('Cookie', mine.cookie)
      .expect(200);

    expect(res.body.data.expenses.length).toBeLessThanOrEqual(3);
    // Groups still appear rather than being squeezed out by the expenses.
    expect(res.body.data.groups.length).toBeGreaterThan(0);
  });

  it('rejects a term that is too short, and a missing one', async () => {
    const { mine } = await world();

    await api().get('/api/search?q=a').set('Cookie', mine.cookie).expect(400);
    await api().get('/api/search').set('Cookie', mine.cookie).expect(400);
    await api().get('/api/search?q=%20%20').set('Cookie', mine.cookie).expect(400);
  });

  it('refuses an unauthenticated request', async () => {
    await world();
    await api().get('/api/search?q=Zebra').expect(401);
  });

  it('finds activity in the caller’s groups only', async () => {
    const { mine } = await world();

    // Expense creation writes an activity row carrying the title in its metadata.
    const results = await find(mine.cookie, 'Zebra shared dinner');
    expect(results.activity.length).toBeGreaterThan(0);
    expect(
      results.activity.every((row) => typeof row.id === 'string'),
    ).toBe(true);

    const leaked = await find(mine.cookie, 'Zebra secret dinner');
    expect(leaked.activity).toHaveLength(0);
  });
});
