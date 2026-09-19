import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

const setup = async (memberCount = 2) => {
  const people = [];
  for (let i = 0; i < memberCount; i += 1) people.push(await member(`user${i}`));

  const res = await api()
    .post('/api/groups')
    .set('Cookie', people[0]!.cookie)
    .send({ name: 'Flat 402' })
    .expect(201);

  const group = res.body.data.group as { id: string; inviteCode: string };
  for (let i = 1; i < memberCount; i += 1) {
    await joinGroupByInvite(group.inviteCode, people[i]!.userId);
  }
  return { groupId: group.id, people };
};

type FeedRow = { type: string; isMe: boolean; metadata: Record<string, unknown> };

const listActivities = async (cookie: string, groupId: string): Promise<FeedRow[]> => {
  const res = await api()
    .get(`/api/groups/${groupId}/activities?limit=50&offset=0`)
    .set('Cookie', cookie)
    .expect(200);
  return res.body.data.activities as FeedRow[];
};

/**
 * Activity rows are written with `void` after the response is sent, exactly like
 * notifications, so reading immediately afterwards can legitimately race the insert.
 * Polling asserts the row does arrive without making the test depend on timing.
 */
const waitForActivity = async (
  cookie: string,
  groupId: string,
  type: string,
): Promise<FeedRow[]> => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = await listActivities(cookie, groupId);
    if (rows.some((row) => row.type === type)) return rows;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`activity "${type}" was never recorded`);
};

/* ========================================================================== */
/* Feed                                                                       */
/* ========================================================================== */

describe('group activity feed', () => {
  it('records group creation', async () => {
    const { groupId, people } = await setup(2);

    const rows = await waitForActivity(people[0]!.cookie, groupId, 'group_created');
    expect(rows.some((row) => row.type === 'group_created')).toBe(true);
  });

  it('records a member joining through an invite', async () => {
    const { groupId, people } = await setup(1);

    const res = await api()
      .get(`/api/groups/${groupId}/share`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    const joiner = await member('joiner');
    await api()
      .post('/api/groups/join')
      .set('Cookie', joiner.cookie)
      .send({ invite: res.body.data.inviteCode })
      .expect(201);

    const rows = await waitForActivity(people[0]!.cookie, groupId, 'member_joined');
    expect(rows.some((row) => row.type === 'member_joined')).toBe(true);
  });

  it('records an expense with the title it had at the time', async () => {
    const { groupId, people } = await setup(2);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
      .expect(201);

    const rows = await waitForActivity(people[0]!.cookie, groupId, 'expense_created');
    const entry = rows.find((row) => row.type === 'expense_created')!;
    expect(entry.metadata.title).toBe('Dinner');
    expect(entry.metadata.amountPaise).toBe(100000);
  });

  it('keeps the original title on the creation entry after a rename', async () => {
    const { groupId, people } = await setup(2);

    const created = await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
      .expect(201);

    await api()
      .patch(`/api/groups/${groupId}/expenses/${created.body.data.expense.id}`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Late dinner' })
      .expect(200);

    const rows = await waitForActivity(people[0]!.cookie, groupId, 'expense_updated');
    expect(rows.find((row) => row.type === 'expense_created')!.metadata.title).toBe('Dinner');
    expect(rows.find((row) => row.type === 'expense_updated')!.metadata.title).toBe('Late dinner');
  });

  it('still names a deleted expense', async () => {
    const { groupId, people } = await setup(2);

    const created = await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
      .expect(201);

    await api()
      .delete(`/api/groups/${groupId}/expenses/${created.body.data.expense.id}`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    const rows = await waitForActivity(people[0]!.cookie, groupId, 'expense_deleted');
    expect(rows.find((row) => row.type === 'expense_deleted')!.metadata.title).toBe('Dinner');
  });

  it('records a settlement being raised', async () => {
    const { groupId, people } = await setup(2);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
      .expect(201);

    await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', people[1]!.cookie)
      // Cash, because a UPI payment additionally requires proof to be attached.
      .send({
        receiverId: people[0]!.userId,
        amount: 500,
        paymentMethod: 'cash',
        actionType: 'payment',
      })
      .expect(201);

    const rows = await waitForActivity(people[1]!.cookie, groupId, 'settlement_created');
    expect(rows.find((row) => row.type === 'settlement_created')!.metadata.amountPaise).toBe(50000);
  });

  it('paginates newest-first and marks each entry from the viewer’s side', async () => {
    const { groupId, people } = await setup(2);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[1]!.cookie)
      .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
      .expect(201);

    await waitForActivity(people[0]!.cookie, groupId, 'expense_created');

    const page = await api()
      .get(`/api/groups/${groupId}/activities?limit=1&offset=0`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    expect(page.body.data.activities).toHaveLength(1);
    expect(page.body.data.pagination.limit).toBe(1);
    expect(page.body.data.pagination.hasMore).toBe(true);

    // Newest first: user1 added the expense, so user0 must not see it as their own.
    expect(page.body.data.activities[0].type).toBe('expense_created');
    expect(page.body.data.activities[0].isMe).toBe(false);

    // The same row read by its actor is theirs.
    const asActor = await api()
      .get(`/api/groups/${groupId}/activities?limit=1&offset=0`)
      .set('Cookie', people[1]!.cookie)
      .expect(200);
    expect(asActor.body.data.activities[0].isMe).toBe(true);

    // The second page continues rather than repeating the first.
    const next = await api()
      .get(`/api/groups/${groupId}/activities?limit=1&offset=1`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);
    expect(next.body.data.activities[0].id).not.toBe(page.body.data.activities[0].id);
  });

  it('hides the feed from non-members', async () => {
    const { groupId } = await setup(2);
    const outsider = await member('outsider');

    await api()
      .get(`/api/groups/${groupId}/activities`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });

  it('requires a session', async () => {
    const { groupId } = await setup(2);
    await api().get(`/api/groups/${groupId}/activities`).expect(401);
  });

  it('rejects an out-of-range limit rather than honouring it', async () => {
    const { groupId, people } = await setup(2);

    await api()
      .get(`/api/groups/${groupId}/activities?limit=5000`)
      .set('Cookie', people[0]!.cookie)
      .expect(400);
  });
});

/* ========================================================================== */
/* Reminders                                                                  */
/* ========================================================================== */

describe('payment reminders', () => {
  /** user1 ends up owing user0 half of a 1000 expense. */
  const withDebt = async () => {
    const { groupId, people } = await setup(2);
    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
      .expect(201);
    return { groupId, people };
  };

  it('sends a reminder for the amount the balance engine reports', async () => {
    const { groupId, people } = await withDebt();

    const res = await api()
      .post(`/api/groups/${groupId}/members/${people[1]!.userId}/remind`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    expect(res.body.data.sent).toBe(true);
    expect(res.body.data.amountPaise).toBe(50000);
  });

  it('ignores any amount supplied in the body', async () => {
    const { groupId, people } = await withDebt();

    const res = await api()
      .post(`/api/groups/${groupId}/members/${people[1]!.userId}/remind`)
      .set('Cookie', people[0]!.cookie)
      .send({ amount: 99999, amountPaise: 9999900 })
      .expect(200);

    expect(res.body.data.amountPaise).toBe(50000);
  });

  it('refuses when the debt runs the other way', async () => {
    const { groupId, people } = await withDebt();

    // user1 owes user0, so user1 has nothing to remind user0 about.
    const res = await api()
      .post(`/api/groups/${groupId}/members/${people[0]!.userId}/remind`)
      .set('Cookie', people[1]!.cookie)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses to remind yourself', async () => {
    const { groupId, people } = await withDebt();

    await api()
      .post(`/api/groups/${groupId}/members/${people[0]!.userId}/remind`)
      .set('Cookie', people[0]!.cookie)
      .expect(400);
  });

  it('404s for someone outside the group', async () => {
    const { groupId, people } = await withDebt();
    const outsider = await member('outsider');

    await api()
      .post(`/api/groups/${groupId}/members/${outsider.userId}/remind`)
      .set('Cookie', people[0]!.cookie)
      .expect(404);
  });

  it('does not let a non-member send reminders into the group', async () => {
    const { groupId, people } = await withDebt();
    const outsider = await member('outsider');

    await api()
      .post(`/api/groups/${groupId}/members/${people[1]!.userId}/remind`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });

  it('notifies the person who owes, and not the sender', async () => {
    const { groupId, people } = await withDebt();

    await api()
      .post(`/api/groups/${groupId}/members/${people[1]!.userId}/remind`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    let received: Array<{ type: string }> = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await api()
        .get('/api/notifications')
        .set('Cookie', people[1]!.cookie)
        .expect(200);
      received = res.body.data.notifications;
      if (received.some((row) => row.type === 'payment_reminder')) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(received.some((row) => row.type === 'payment_reminder')).toBe(true);

    const mine = await api()
      .get('/api/notifications')
      .set('Cookie', people[0]!.cookie)
      .expect(200);
    expect(
      (mine.body.data.notifications as Array<{ type: string }>).some(
        (row) => row.type === 'payment_reminder',
      ),
    ).toBe(false);
  });
});
