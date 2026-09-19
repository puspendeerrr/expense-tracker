import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import {
  computeNetPositions,
  planTransfers,
} from '../src/services/settlementPlanService.js';
import { getPairwiseDebts } from '../src/services/balanceService.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

/* ========================================================================== */
/* The planner, in isolation                                                  */
/* ========================================================================== */

describe('net positions', () => {
  it('collapses a chain into two positions', () => {
    // A owes B 500, B owes C 500. B is square; A pays, C receives.
    const positions = computeNetPositions([
      { debtorId: 'A', creditorId: 'B', owedPaise: 50_000 },
      { debtorId: 'B', creditorId: 'C', owedPaise: 50_000 },
    ]);

    expect(positions).toEqual([
      { userId: 'C', netPaise: 50_000 },
      { userId: 'A', netPaise: -50_000 },
    ]);
  });

  it('drops anyone whose debts cancel out', () => {
    const positions = computeNetPositions([
      { debtorId: 'A', creditorId: 'B', owedPaise: 50_000 },
      { debtorId: 'B', creditorId: 'A', owedPaise: 50_000 },
    ]);

    expect(positions).toEqual([]);
  });

  it('nets both directions within one pair', () => {
    const positions = computeNetPositions([
      { debtorId: 'A', creditorId: 'B', owedPaise: 50_000 },
      { debtorId: 'B', creditorId: 'A', owedPaise: 30_000 },
    ]);

    expect(positions).toEqual([
      { userId: 'B', netPaise: 20_000 },
      { userId: 'A', netPaise: -20_000 },
    ]);
  });
});

describe('transfer planning', () => {
  it('turns a three-person chain into a single payment', () => {
    const transfers = planTransfers([
      { userId: 'C', netPaise: 50_000 },
      { userId: 'A', netPaise: -50_000 },
    ]);

    expect(transfers).toEqual([
      { fromUserId: 'A', toUserId: 'C', amountPaise: 50_000, recordablePaise: 0 },
    ]);
  });

  it('never proposes more than n-1 transfers', () => {
    const positions = [
      { userId: 'A', netPaise: -30_000 },
      { userId: 'B', netPaise: -20_000 },
      { userId: 'C', netPaise: 10_000 },
      { userId: 'D', netPaise: 40_000 },
    ];

    const transfers = planTransfers(positions);
    expect(transfers.length).toBeLessThanOrEqual(positions.length - 1);
  });

  it('conserves money: what is paid equals what is received', () => {
    const positions = [
      { userId: 'A', netPaise: -33_333 },
      { userId: 'B', netPaise: -66_667 },
      { userId: 'C', netPaise: 100_000 },
    ];

    const transfers = planTransfers(positions);
    const paid = transfers.reduce((total, t) => total + t.amountPaise, 0);
    expect(paid).toBe(100_000);

    for (const position of positions) {
      const out = transfers
        .filter((t) => t.fromUserId === position.userId)
        .reduce((total, t) => total + t.amountPaise, 0);
      const inbound = transfers
        .filter((t) => t.toUserId === position.userId)
        .reduce((total, t) => total + t.amountPaise, 0);
      expect(inbound - out).toBe(position.netPaise);
    }
  });

  it('plans nothing when everyone is square', () => {
    expect(planTransfers([])).toEqual([]);
  });

  it('is deterministic for the same ledger', () => {
    const positions = [
      { userId: 'A', netPaise: -50_000 },
      { userId: 'B', netPaise: -50_000 },
      { userId: 'C', netPaise: 100_000 },
    ];
    expect(planTransfers(positions)).toEqual(planTransfers(positions));
  });
});

/* ========================================================================== */
/* Through the API, against real balances                                     */
/* ========================================================================== */

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

const setup = async (memberCount = 3) => {
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

const addExpense = (
  cookie: string,
  groupId: string,
  amount: number,
  participantIds: string[],
) =>
  api()
    .post(`/api/groups/${groupId}/expenses`)
    .set('Cookie', cookie)
    .send({
      title: 'Dinner',
      amount,
      expenseDate: TODAY,
      splitType: 'specific',
      participantIds,
    })
    .expect(201);

const getPlan = async (cookie: string, groupId: string) => {
  const res = await api()
    .get(`/api/groups/${groupId}/settlements/plan`)
    .set('Cookie', cookie)
    .expect(200);
  return res.body.data;
};

describe('settle-up plan endpoint', () => {
  it('reports everyone settled in a group with no expenses', async () => {
    const { groupId, people } = await setup(2);

    const plan = await getPlan(people[0]!.cookie, groupId);
    expect(plan.allSettled).toBe(true);
    expect(plan.transfers).toEqual([]);
    expect(plan.currentTransferCount).toBe(0);
  });

  it('proposes fewer payments than the raw ledger for a chain of debts', async () => {
    const { groupId, people } = await setup(3);
    const [a, b, c] = people as [typeof people[0], typeof people[0], typeof people[0]];

    // B pays for A, C pays for B -- a chain that nets down to one payment.
    await addExpense(b.cookie, groupId, 1000, [a.userId, b.userId]);
    await addExpense(c.cookie, groupId, 1000, [b.userId, c.userId]);

    const plan = await getPlan(a.cookie, groupId);

    expect(plan.currentTransferCount).toBe(2);
    expect(plan.suggestedTransferCount).toBe(1);
    expect(plan.transfers[0].from.id).toBe(a.userId);
    expect(plan.transfers[0].to.id).toBe(c.userId);
    expect(plan.transfers[0].amountPaise).toBe(50_000);
  });

  it('marks a transfer unrecordable when no direct debt backs it', async () => {
    const { groupId, people } = await setup(3);
    const [a, b, c] = people as [typeof people[0], typeof people[0], typeof people[0]];

    await addExpense(b.cookie, groupId, 1000, [a.userId, b.userId]);
    await addExpense(c.cookie, groupId, 1000, [b.userId, c.userId]);

    const plan = await getPlan(a.cookie, groupId);

    // The plan says A pays C, but A never borrowed from C: the settlement engine
    // would refuse it, and the response says so rather than offering a dead button.
    expect(plan.transfers[0].recordable).toBe(false);
    expect(plan.transfers[0].recordablePaise).toBe(0);
  });

  it('marks a transfer recordable when a direct debt covers it', async () => {
    const { groupId, people } = await setup(2);
    const [a, b] = people as [typeof people[0], typeof people[0]];

    await addExpense(a.cookie, groupId, 1000, [a.userId, b.userId]);

    const plan = await getPlan(a.cookie, groupId);

    expect(plan.transfers).toHaveLength(1);
    expect(plan.transfers[0].from.id).toBe(b.userId);
    expect(plan.transfers[0].to.id).toBe(a.userId);
    expect(plan.transfers[0].recordable).toBe(true);
    expect(plan.transfers[0].recordablePaise).toBe(50_000);
  });

  it('never proposes a transfer the balance engine does not fund', async () => {
    const { groupId, people } = await setup(3);
    const [a, b, c] = people as [typeof people[0], typeof people[0], typeof people[0]];

    await addExpense(a.cookie, groupId, 900, [a.userId, b.userId, c.userId]);
    await addExpense(b.cookie, groupId, 300, [a.userId, b.userId]);

    const plan = await getPlan(a.cookie, groupId);
    const debts = await getPairwiseDebts(groupId);
    const totalOwed = debts.reduce((total, debt) => total + debt.owedPaise, 0);
    const totalPlanned = plan.transfers.reduce(
      (total: number, t: { amountPaise: number }) => total + t.amountPaise,
      0,
    );

    // Netting can only ever reduce the money that needs to move, never increase it.
    expect(totalPlanned).toBeLessThanOrEqual(totalOwed);
    expect(totalPlanned).toBeGreaterThan(0);
  });

  it('changes nothing: the ledger is identical before and after asking', async () => {
    const { groupId, people } = await setup(3);
    const [a, b, c] = people as [typeof people[0], typeof people[0], typeof people[0]];

    await addExpense(b.cookie, groupId, 1000, [a.userId, b.userId]);
    await addExpense(c.cookie, groupId, 1000, [b.userId, c.userId]);

    const before = await getPairwiseDebts(groupId);
    await getPlan(a.cookie, groupId);
    await getPlan(b.cookie, groupId);
    const after = await getPairwiseDebts(groupId);

    expect(after).toEqual(before);
  });

  it('flags which transfers involve the person asking', async () => {
    const { groupId, people } = await setup(3);
    const [a, b, c] = people as [typeof people[0], typeof people[0], typeof people[0]];

    await addExpense(b.cookie, groupId, 1000, [a.userId, b.userId]);
    await addExpense(c.cookie, groupId, 1000, [b.userId, c.userId]);

    const forA = await getPlan(a.cookie, groupId);
    const forB = await getPlan(b.cookie, groupId);

    expect(forA.transfers[0].involvesMe).toBe(true);
    // B nets to zero in this chain, so the one remaining payment is not theirs.
    expect(forB.transfers[0].involvesMe).toBe(false);
  });

  it('hides the plan from non-members', async () => {
    const { groupId } = await setup(2);
    const outsider = await member('outsider');

    await api()
      .get(`/api/groups/${groupId}/settlements/plan`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });

  it('requires a session', async () => {
    const { groupId } = await setup(2);
    await api().get(`/api/groups/${groupId}/settlements/plan`).expect(401);
  });
});
