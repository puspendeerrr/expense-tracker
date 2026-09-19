import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const dayOffset = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const TODAY = dayOffset(0);
/** The furthest-ahead date a client in UTC+14 could legitimately call "today". */
const TOMORROW = dayOffset(1);
const DAY_AFTER_TOMORROW = dayOffset(2);
const NEXT_WEEK = dayOffset(7);

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

/** Builds a group with N members via the real API; returns cookies and ids. */
const setup = async (memberCount = 3) => {
  const people = [];
  for (let i = 0; i < memberCount; i += 1) {
    people.push(await member(`user${i}`));
  }

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

const addExpense = (
  cookie: string,
  groupId: string,
  body: Record<string, unknown>,
) =>
  api()
    .post(`/api/groups/${groupId}/expenses`)
    .set('Cookie', cookie)
    .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY, ...body });

/* ========================================================================== */

describe('expense creation', () => {
  it('creates an equal split and returns paise plus rupees', async () => {
    const { groupId, people } = await setup(3);

    const res = await addExpense(people[0]!.cookie, groupId, {}).expect(201);
    const expense = res.body.data.expense;

    expect(expense.amountPaise).toBe(100000);
    expect(expense.amount).toBe(1000);
    expect(expense.participantCount).toBe(3);
    expect(expense.involvement).toBe('paid_by_me');

    const shares = expense.participants.map((p: { sharePaise: number }) => p.sharePaise);
    expect(shares.reduce((a: number, b: number) => a + b, 0)).toBe(100000);
    expect(shares.sort((a: number, b: number) => b - a)).toEqual([33334, 33333, 33333]);
  });

  it('creates a specific split across chosen participants only', async () => {
    const { groupId, people } = await setup(3);

    const res = await addExpense(people[0]!.cookie, groupId, {
      splitType: 'specific',
      participantIds: [people[0]!.userId, people[1]!.userId],
      amount: 500,
    }).expect(201);

    expect(res.body.data.expense.participantCount).toBe(2);
    expect(res.body.data.expense.mySharePaise).toBe(25000);
  });

  it('defaults the payer to the caller', async () => {
    const { groupId, people } = await setup(2);
    const res = await addExpense(people[1]!.cookie, groupId, {}).expect(201);
    expect(res.body.data.expense.paidBy).toBe(people[1]!.userId);
  });

  it('rejects amounts finer than a paisa', async () => {
    const { groupId, people } = await setup(2);
    const res = await addExpense(people[0]!.cookie, groupId, { amount: 45.075 }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects zero, negative and non-numeric amounts', async () => {
    const { groupId, people } = await setup(2);
    for (const amount of [0, -5, 'abc', '']) {
      const res = await addExpense(people[0]!.cookie, groupId, { amount }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('accepts ₹0.01', async () => {
    const { groupId, people } = await setup(3);
    const res = await addExpense(people[0]!.cookie, groupId, { amount: 0.01 }).expect(201);
    expect(res.body.data.expense.amountPaise).toBe(1);
    const shares = res.body.data.expense.participants.map((p: { sharePaise: number }) => p.sharePaise);
    expect(shares.reduce((a: number, b: number) => a + b, 0)).toBe(1);
  });

  it('requires a title', async () => {
    const { groupId, people } = await setup(2);
    await addExpense(people[0]!.cookie, groupId, { title: '   ' }).expect(400);
  });

  it('rejects a future date but tolerates one day of timezone skew', async () => {
    const { groupId, people } = await setup(2);

    await addExpense(people[0]!.cookie, groupId, { expenseDate: NEXT_WEEK }).expect(400);
    // Two days out is unambiguously the future, whatever the caller's timezone.
    await addExpense(people[0]!.cookie, groupId, { expenseDate: DAY_AFTER_TOMORROW }).expect(400);
    // But a client in UTC+14, whose local date is a day ahead of UTC, must still be
    // able to file what they call "today".
    await addExpense(people[0]!.cookie, groupId, { expenseDate: TOMORROW }).expect(201);
  });

  it('rejects a malformed date', async () => {
    const { groupId, people } = await setup(2);
    await addExpense(people[0]!.cookie, groupId, { expenseDate: '15-01-2026' }).expect(400);
  });

  it('rejects a specific split with no participants', async () => {
    const { groupId, people } = await setup(2);
    const res = await addExpense(people[0]!.cookie, groupId, {
      splitType: 'specific',
      participantIds: [],
    }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a participant outside the group', async () => {
    const { groupId, people } = await setup(2);
    const outsider = await member('outsider');

    const res = await addExpense(people[0]!.cookie, groupId, {
      splitType: 'specific',
      participantIds: [people[0]!.userId, outsider.userId],
    }).expect(400);
    expect(res.body.error.code).toBe('INVALID_PARTICIPANTS');
  });

  it('rejects a payer outside the group', async () => {
    const { groupId, people } = await setup(2);
    const outsider = await member('outsider');

    const res = await addExpense(people[0]!.cookie, groupId, {
      paidBy: outsider.userId,
    }).expect(400);
    expect(res.body.error.code).toBe('PAYER_NOT_IN_GROUP');
  });

  it('rejects unknown fields', async () => {
    const { groupId, people } = await setup(2);
    await addExpense(people[0]!.cookie, groupId, { isAdmin: true }).expect(400);
  });

  it('stores an optional category', async () => {
    const { groupId, people } = await setup(2);
    const res = await addExpense(people[0]!.cookie, groupId, { category: 'groceries' }).expect(201);
    expect(res.body.data.expense.category).toBe('groceries');
  });
});

describe('expense access control', () => {
  it('blocks a non-member from listing or creating', async () => {
    const { groupId } = await setup(2);
    const mallory = await member('mallory');

    await api().get(`/api/groups/${groupId}/expenses`).set('Cookie', mallory.cookie).expect(404);
    await addExpense(mallory.cookie, groupId, {}).expect(404);
  });

  it('blocks an unauthenticated caller', async () => {
    const { groupId } = await setup(2);
    await api().get(`/api/groups/${groupId}/expenses`).expect(401);
  });

  it('does not leak an expense across groups', async () => {
    const a = await setup(2);
    const expense = await addExpense(a.people[0]!.cookie, a.groupId, {}).expect(201);

    // A second group whose member tries to read the first group's expense by id.
    const outsider = await member('outsider');
    const res = await api()
      .post('/api/groups')
      .set('Cookie', outsider.cookie)
      .send({ name: 'Other' })
      .expect(201);
    const otherGroupId = res.body.data.group.id;

    await api()
      .get(`/api/groups/${otherGroupId}/expenses/${expense.body.data.expense.id}`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });
});

describe('expense edit and delete', () => {
  it('edits and keeps shares reconciled', async () => {
    const { groupId, people } = await setup(3);
    const created = await addExpense(people[0]!.cookie, groupId, {}).expect(201);
    const id = created.body.data.expense.id;

    const res = await api()
      .patch(`/api/groups/${groupId}/expenses/${id}`)
      .set('Cookie', people[0]!.cookie)
      .send({ amount: 1000, title: 'Updated dinner' })
      .expect(200);

    const shares = res.body.data.expense.participants.map(
      (p: { sharePaise: number }) => p.sharePaise,
    );
    expect(shares.reduce((a: number, b: number) => a + b, 0)).toBe(100000);
    expect(res.body.data.expense.title).toBe('Updated dinner');
  });

  it('lets only the payer edit or delete', async () => {
    const { groupId, people } = await setup(3);
    const created = await addExpense(people[0]!.cookie, groupId, {}).expect(201);
    const id = created.body.data.expense.id;

    const edit = await api()
      .patch(`/api/groups/${groupId}/expenses/${id}`)
      .set('Cookie', people[1]!.cookie)
      .send({ title: 'Hijack' })
      .expect(403);
    expect(edit.body.error.code).toBe('FORBIDDEN');

    await api()
      .delete(`/api/groups/${groupId}/expenses/${id}`)
      .set('Cookie', people[1]!.cookie)
      .expect(403);
  });

  it('deletes an expense', async () => {
    const { groupId, people } = await setup(2);
    const created = await addExpense(people[0]!.cookie, groupId, {}).expect(201);
    const id = created.body.data.expense.id;

    await api()
      .delete(`/api/groups/${groupId}/expenses/${id}`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    await api()
      .get(`/api/groups/${groupId}/expenses/${id}`)
      .set('Cookie', people[0]!.cookie)
      .expect(404);
  });
});

describe('expense listing', () => {
  it('paginates without ever returning an unbounded list', async () => {
    const { groupId, people } = await setup(2);
    for (let i = 0; i < 7; i += 1) {
      await addExpense(people[0]!.cookie, groupId, { title: `Item ${i}`, amount: 100 + i }).expect(201);
    }

    const page1 = await api()
      .get(`/api/groups/${groupId}/expenses?limit=3&offset=0`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    expect(page1.body.data.expenses).toHaveLength(3);
    expect(page1.body.data.pagination.total).toBe(7);
    expect(page1.body.data.pagination.hasMore).toBe(true);

    const page3 = await api()
      .get(`/api/groups/${groupId}/expenses?limit=3&offset=6`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);

    expect(page3.body.data.expenses).toHaveLength(1);
    expect(page3.body.data.pagination.hasMore).toBe(false);
  });

  it('reports each viewer their own share and involvement', async () => {
    const { groupId, people } = await setup(3);
    await addExpense(people[0]!.cookie, groupId, { amount: 900 }).expect(201);

    const asPayer = await api()
      .get(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[0]!.cookie)
      .expect(200);
    expect(asPayer.body.data.expenses[0].involvement).toBe('paid_by_me');
    expect(asPayer.body.data.expenses[0].mySharePaise).toBe(30000);

    const asBeneficiary = await api()
      .get(`/api/groups/${groupId}/expenses`)
      .set('Cookie', people[1]!.cookie)
      .expect(200);
    expect(asBeneficiary.body.data.expenses[0].involvement).toBe('paid_by_others_for_me');
  });
});

/* ========================================================================== */
/* Settlements                                                                */
/* ========================================================================== */

describe('settlement API', () => {
  const setupDebt = async () => {
    const { groupId, people } = await setup(2);
    // Alice pays 1000 for both, so Bob owes 500.
    await addExpense(people[0]!.cookie, groupId, { amount: 1000 }).expect(201);
    return { groupId, alice: people[0]!, bob: people[1]! };
  };

  it('reports outstanding amounts in both directions', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const res = await api()
      .get(`/api/groups/${groupId}/settlements/outstanding/${alice.userId}`)
      .set('Cookie', bob.cookie)
      .expect(200);

    expect(res.body.data.iOwePaise).toBe(50000);
    expect(res.body.data.theyOwePaise).toBe(0);
    expect(res.body.data.maxSettleablePaise).toBe(50000);
  });

  it('records a cash settlement and completes it on approval', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const created = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 500, paymentMethod: 'cash' })
      .expect(201);

    expect(created.body.data.settlement.status).toBe('paid_pending_approval');
    expect(created.body.data.settlement.direction).toBe('outgoing');

    const id = created.body.data.settlement.id;

    await api()
      .post(`/api/groups/${groupId}/settlements/${id}/approve`)
      .set('Cookie', alice.cookie)
      .expect(200);

    const after = await api()
      .get(`/api/groups/${groupId}/settlements/outstanding/${alice.userId}`)
      .set('Cookie', bob.cookie)
      .expect(200);
    expect(after.body.data.iOwePaise).toBe(0);
  });

  it('rejects an over-settlement through the API', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const res = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 900, paymentMethod: 'cash' })
      .expect(400);

    expect(res.body.error.code).toBe('SETTLEMENT_EXCEEDS_DEBT');
    expect(res.body.error.details.outstandingPaise).toBe(50000);
  });

  it('requires proof for UPI', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const res = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 100, paymentMethod: 'upi' })
      .expect(400);
    expect(res.body.error.code).toBe('SETTLEMENT_PROOF_REQUIRED');
  });

  it('refuses to let the payer approve their own settlement', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const created = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 500, paymentMethod: 'cash' })
      .expect(201);

    await api()
      .post(`/api/groups/${groupId}/settlements/${created.body.data.settlement.id}/approve`)
      .set('Cookie', bob.cookie)
      .expect(403);
  });

  it('runs the reject then re-upload cycle', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const created = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 500, paymentMethod: 'cash' })
      .expect(201);
    const id = created.body.data.settlement.id;

    const rejected = await api()
      .post(`/api/groups/${groupId}/settlements/${id}/reject`)
      .set('Cookie', alice.cookie)
      .send({ rejectionReason: 'Never received it' })
      .expect(200);
    expect(rejected.body.data.settlement.status).toBe('rejected');
    expect(rejected.body.data.settlement.rejectionReason).toBe('Never received it');

    const reuploaded = await api()
      .post(`/api/groups/${groupId}/settlements/${id}/proof`)
      .set('Cookie', bob.cookie)
      .send({ proofUrl: 'https://example.test/proof.png' })
      .expect(200);
    expect(reuploaded.body.data.settlement.status).toBe('paid_pending_approval');
    expect(reuploaded.body.data.settlement.rejectionReason).toBe('');

    // The debt is still live until approval.
    const outstanding = await api()
      .get(`/api/groups/${groupId}/settlements/outstanding/${alice.userId}`)
      .set('Cookie', bob.cookie)
      .expect(200);
    expect(outstanding.body.data.iOwePaise).toBe(50000);
  });

  it('cannot cancel a completed settlement', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const created = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 500, paymentMethod: 'cash' })
      .expect(201);
    const id = created.body.data.settlement.id;

    await api()
      .post(`/api/groups/${groupId}/settlements/${id}/approve`)
      .set('Cookie', alice.cookie)
      .expect(200);

    const res = await api()
      .post(`/api/groups/${groupId}/settlements/${id}/cancel`)
      .set('Cookie', bob.cookie)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('SETTLEMENT_INVALID_STATE');
  });

  it('never lets the payer be spoofed', async () => {
    const { groupId, alice, bob } = await setupDebt();

    // Bob submits, naming Alice as receiver. Even if a payerId were supplied it is
    // ignored: the payer is always the authenticated caller.
    const res = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 100, paymentMethod: 'cash', payerId: alice.userId })
      .expect(400);

    // `.strict()` rejects the unknown field outright.
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('surfaces the attention centre with balances', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const created = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 500, paymentMethod: 'cash' })
      .expect(201);

    const forAlice = await api()
      .get(`/api/groups/${groupId}/settlements/attention`)
      .set('Cookie', alice.cookie)
      .expect(200);

    expect(forAlice.body.data.awaitingMyApproval).toHaveLength(1);
    expect(forAlice.body.data.totalActionable).toBe(1);
    expect(forAlice.body.data.balances.youWillReceiveTotalPaise).toBe(50000);

    const forBob = await api()
      .get(`/api/groups/${groupId}/settlements/attention`)
      .set('Cookie', bob.cookie)
      .expect(200);

    expect(forBob.body.data.awaitingTheirApproval).toHaveLength(1);
    expect(forBob.body.data.awaitingMyApproval).toHaveLength(0);
    expect(forBob.body.data.balances.youNeedToPayTotalPaise).toBe(50000);
    void created;
  });

  it('filters settlement history by status', async () => {
    const { groupId, alice, bob } = await setupDebt();

    const a = await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 100, paymentMethod: 'cash' })
      .expect(201);

    await api()
      .post(`/api/groups/${groupId}/settlements/${a.body.data.settlement.id}/approve`)
      .set('Cookie', alice.cookie)
      .expect(200);

    await api()
      .post(`/api/groups/${groupId}/settlements`)
      .set('Cookie', bob.cookie)
      .send({ receiverId: alice.userId, amount: 100, paymentMethod: 'cash' })
      .expect(201);

    const completed = await api()
      .get(`/api/groups/${groupId}/settlements?status=completed`)
      .set('Cookie', alice.cookie)
      .expect(200);
    expect(completed.body.data.settlements).toHaveLength(1);

    const all = await api()
      .get(`/api/groups/${groupId}/settlements?status=all`)
      .set('Cookie', alice.cookie)
      .expect(200);
    expect(all.body.data.settlements).toHaveLength(2);
  });
});
