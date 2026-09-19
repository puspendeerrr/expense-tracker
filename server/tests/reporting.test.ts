import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import { createExpense } from '../src/services/expenseService.js';
import {
  approveSettlement,
  createSettlement,
} from '../src/services/settlementService.js';
import { rupeesToPaise } from '../src/utils/money.js';
import { db } from '../src/db/client.js';
import { groups } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

beforeEach(resetAll);
afterAll(closeDatabase);

const dayOffset = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const TODAY = dayOffset(0);

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId, name };
};

const setup = async (count = 3) => {
  const people = [];
  for (let i = 0; i < count; i += 1) people.push(await member(`user${i}`));

  const res = await api()
    .post('/api/groups')
    .set('Cookie', people[0]!.cookie)
    .send({ name: 'Flat 402' })
    .expect(201);

  const group = res.body.data.group as { id: string; inviteCode: string };
  for (let i = 1; i < count; i += 1) await joinGroupByInvite(group.inviteCode, people[i]!.userId);

  return { groupId: group.id, people };
};

const spend = (
  groupId: string,
  paidBy: string,
  rupees: number,
  opts: {
    participantIds?: string[];
    date?: string;
    paymentMode?: 'cash' | 'upi';
    category?: string;
    title?: string;
  } = {},
) =>
  createExpense({
    groupId,
    actorUserId: paidBy,
    title: opts.title ?? `Expense ${rupees}`,
    amountPaise: rupeesToPaise(rupees)!,
    paidBy,
    splitType: opts.participantIds ? 'specific' : 'everyone',
    participantIds: opts.participantIds,
    paymentMode: opts.paymentMode ?? 'cash',
    category: (opts.category ?? null) as never,
    expenseDate: opts.date ?? TODAY,
  });

const report = async (
  cookie: string,
  groupId: string,
  query: Record<string, string> = {},
) => {
  const params = new URLSearchParams(query).toString();
  const res = await api()
    .get(`/api/groups/${groupId}/reports/dashboard${params ? `?${params}` : ''}`)
    .set('Cookie', cookie)
    .expect(200);
  return res.body.data;
};

/* ========================================================================== */

describe('report scopes', () => {
  it('live scope returns balances and ignores date filters', async () => {
    const { groupId, people } = await setup(2);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 1000, { date: dayOffset(-60) });

    // A window that excludes the expense entirely must not change what is owed.
    const live = await report(alice.cookie, groupId, {
      scope: 'live',
      from: TODAY,
      to: TODAY,
    });

    expect(live.balances.youWillReceiveTotal.paise).toBe(50000);
    expect(live.peopleWhoOweMe).toHaveLength(1);
    expect(live.peopleWhoOweMe[0].user.id).toBe(bob.userId);
    expect(live.peopleWhoOweMe[0].amountPaise).toBe(50000);
  });

  it('analytics scope reflects the date window', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;

    await spend(groupId, alice.userId, 1000, { date: dayOffset(-60) });
    await spend(groupId, alice.userId, 400, { date: TODAY });

    const all = await report(alice.cookie, groupId, { scope: 'analytics' });
    expect(all.periodSummary.totalExpense.paise).toBe(140000);
    expect(all.periodSummary.expenseCount).toBe(2);

    const todayOnly = await report(alice.cookie, groupId, {
      scope: 'analytics',
      from: TODAY,
      to: TODAY,
    });
    expect(todayOnly.periodSummary.totalExpense.paise).toBe(40000);
    expect(todayOnly.periodSummary.expenseCount).toBe(1);
  });

  it('chart scope returns only the time series', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;

    await spend(groupId, alice.userId, 100, { date: dayOffset(-2) });
    await spend(groupId, alice.userId, 200, { date: dayOffset(-1) });
    await spend(groupId, alice.userId, 300, { date: TODAY });

    const chart = await report(alice.cookie, groupId, { scope: 'chart' });

    expect(chart.grouping).toBe('day');
    expect(chart.periodBreakdown).toHaveLength(3);
    expect(chart.periodBreakdown.map((b: { totalExpensePaise: number }) => b.totalExpensePaise)).toEqual([
      10000, 20000, 30000,
    ]);
    // The chart region carries no balance data at all.
    expect(chart.balances).toBeUndefined();
  });

  it('auto-groups by week and month as the span grows', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;

    await spend(groupId, alice.userId, 100, { date: dayOffset(-200) });
    await spend(groupId, alice.userId, 100, { date: TODAY });

    const chart = await report(alice.cookie, groupId, { scope: 'chart' });
    expect(chart.grouping).toBe('week');

    await spend(groupId, alice.userId, 100, { date: dayOffset(-500) });
    const wider = await report(alice.cookie, groupId, { scope: 'chart' });
    expect(wider.grouping).toBe('month');
  });

  it('honours an explicit groupBy', async () => {
    const { groupId, people } = await setup(2);
    await spend(groupId, people[0]!.userId, 100);

    const chart = await report(people[0]!.cookie, groupId, {
      scope: 'chart',
      groupBy: 'month',
    });
    expect(chart.grouping).toBe('month');
  });
});

/* ========================================================================== */

describe('attribution is not obligation', () => {
  it('keeps "I paid for them" separate from "they currently owe"', async () => {
    const { groupId, people } = await setup(2);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    // Alice pays ₹2000 for both: Bob's share is ₹1000.
    await spend(groupId, alice.userId, 2000);

    let res = await api()
      .get(`/api/groups/${groupId}/reports/relationships`)
      .set('Cookie', alice.cookie)
      .expect(200);

    let row = res.body.data.relationships[0];
    expect(row.person.id).toBe(bob.userId);
    expect(row.iPaidForThem.paise).toBe(100000);
    expect(row.theyCurrentlyOwe.paise).toBe(100000);

    // Bob settles in full.
    const settlement = await createSettlement({
      groupId,
      payerId: bob.userId,
      receiverId: alice.userId,
      amountPaise: 100000,
      paymentMethod: 'cash',
      actionType: 'payment',
    });
    await approveSettlement(settlement.id, groupId, alice.userId);

    res = await api()
      .get(`/api/groups/${groupId}/reports/relationships`)
      .set('Cookie', alice.cookie)
      .expect(200);

    row = res.body.data.relationships[0];
    // History is unchanged...
    expect(row.iPaidForThem.paise).toBe(100000);
    // ...but the obligation is gone. This is the distinction the product depends on.
    expect(row.theyCurrentlyOwe.paise).toBe(0);
    expect(row.iCurrentlyOwe.paise).toBe(0);
  });

  it('still lists someone with a live debt but no activity in the window', async () => {
    const { groupId, people } = await setup(2);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 1000, { date: dayOffset(-90) });

    const res = await api()
      .get(
        `/api/groups/${groupId}/reports/relationships?from=${TODAY}&to=${TODAY}`,
      )
      .set('Cookie', alice.cookie)
      .expect(200);

    const row = res.body.data.relationships.find(
      (r: { person: { id: string } }) => r.person.id === bob.userId,
    );
    expect(row).toBeDefined();
    expect(row.iPaidForThem.paise).toBe(0); // nothing in this window
    expect(row.theyCurrentlyOwe.paise).toBe(50000); // but the debt is real
  });
});

/* ========================================================================== */

describe('period summary metrics are distinct', () => {
  it('separates total paid, my share, paid-for-others and paid-by-others', async () => {
    const { groupId, people } = await setup(3);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    // Alice pays ₹900 three ways -> her share ₹300, she funded ₹600 for others.
    await spend(groupId, alice.userId, 900);
    // Bob pays ₹300 three ways -> Alice benefits ₹100.
    await spend(groupId, bob.userId, 300);

    const data = await report(alice.cookie, groupId, { scope: 'analytics' });
    const s = data.periodSummary;

    expect(s.totalExpense.paise).toBe(120000);
    expect(s.totalPaidByMe.paise).toBe(90000);
    expect(s.myShare.paise).toBe(40000); // 300 + 100
    expect(s.paidForOthers.paise).toBe(60000);
    expect(s.paidByOthersForMe.paise).toBe(10000);
    expect(s.expenseCount).toBe(2);
    expect(s.averageExpense.paise).toBe(60000);
    expect(s.largestExpense.amountPaise).toBe(90000);
  });

  it('reconciles: total paid by everyone equals total expense', async () => {
    const { groupId, people } = await setup(4);

    for (let i = 0; i < 4; i += 1) {
      await spend(groupId, people[i]!.userId, 100 * (i + 1) + 0.07);
    }

    let sumOfPaidByMe = 0;
    let sumOfMyShare = 0;
    let total = 0;

    for (const person of people) {
      const data = await report(person.cookie, groupId, { scope: 'analytics' });
      sumOfPaidByMe += data.periodSummary.totalPaidByMe.paise;
      sumOfMyShare += data.periodSummary.myShare.paise;
      total = data.periodSummary.totalExpense.paise;
    }

    // Every rupee was paid by exactly one person and consumed by the group.
    expect(sumOfPaidByMe).toBe(total);
    expect(sumOfMyShare).toBe(total);
  });
});

/* ========================================================================== */

describe('filters', () => {
  it('filters by payment mode', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;

    await spend(groupId, alice.userId, 100, { paymentMode: 'cash' });
    await spend(groupId, alice.userId, 250, { paymentMode: 'upi' });

    const cash = await report(alice.cookie, groupId, { scope: 'analytics', paymentMode: 'cash' });
    expect(cash.periodSummary.totalExpense.paise).toBe(10000);

    const upi = await report(alice.cookie, groupId, { scope: 'analytics', paymentMode: 'upi' });
    expect(upi.periodSummary.totalExpense.paise).toBe(25000);
  });

  it('filters by involvement', async () => {
    const { groupId, people } = await setup(3);
    const [alice, bob, carol] = people as [typeof people[0], typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 300); // Alice pays, everyone benefits
    await spend(groupId, bob.userId, 600); // Bob pays, everyone benefits
    await spend(groupId, bob.userId, 100, { participantIds: [bob.userId, carol.userId] });

    const paidByMe = await report(alice.cookie, groupId, {
      scope: 'analytics',
      involvement: 'paid_by_me',
    });
    expect(paidByMe.periodSummary.expenseCount).toBe(1);

    const forMe = await report(alice.cookie, groupId, {
      scope: 'analytics',
      involvement: 'paid_by_others_for_me',
    });
    expect(forMe.periodSummary.expenseCount).toBe(1); // Bob's 600, not the 100

    const involving = await report(alice.cookie, groupId, {
      scope: 'analytics',
      involvement: 'involving_me',
    });
    expect(involving.periodSummary.expenseCount).toBe(2);

    const all = await report(alice.cookie, groupId, { scope: 'analytics', involvement: 'all' });
    expect(all.periodSummary.expenseCount).toBe(3);
  });

  it('filters by member', async () => {
    const { groupId, people } = await setup(3);
    const [alice, bob, carol] = people as [typeof people[0], typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 300, { participantIds: [alice.userId, bob.userId] });
    await spend(groupId, alice.userId, 200, { participantIds: [alice.userId, carol.userId] });

    const forBob = await report(alice.cookie, groupId, {
      scope: 'analytics',
      memberId: bob.userId,
    });
    expect(forBob.periodSummary.expenseCount).toBe(1);
    expect(forBob.relationships).toHaveLength(1);
    expect(forBob.relationships[0].person.id).toBe(bob.userId);
  });

  it('filters by category', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;

    await spend(groupId, alice.userId, 100, { category: 'groceries' });
    await spend(groupId, alice.userId, 500, { category: 'rent' });

    const groceries = await report(alice.cookie, groupId, {
      scope: 'analytics',
      category: 'groceries',
    });
    expect(groceries.periodSummary.totalExpense.paise).toBe(10000);
  });

  it('combines filters', async () => {
    const { groupId, people } = await setup(3);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 100, { paymentMode: 'upi', date: TODAY });
    await spend(groupId, alice.userId, 200, { paymentMode: 'cash', date: TODAY });
    await spend(groupId, bob.userId, 300, { paymentMode: 'upi', date: TODAY });

    const combined = await report(alice.cookie, groupId, {
      scope: 'analytics',
      paymentMode: 'upi',
      involvement: 'paid_by_me',
      from: TODAY,
      to: TODAY,
    });

    expect(combined.periodSummary.expenseCount).toBe(1);
    expect(combined.periodSummary.totalExpense.paise).toBe(10000);
  });

  it('rejects an inverted date range', async () => {
    const { groupId, people } = await setup(2);
    const res = await api()
      .get(
        `/api/groups/${groupId}/reports/dashboard?from=${dayOffset(5)}&to=${dayOffset(-5)}`,
      )
      .set('Cookie', people[0]!.cookie)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

/* ========================================================================== */

describe('empty and access states', () => {
  it('returns intentional zeroes for a group with no expenses', async () => {
    const { groupId, people } = await setup(2);

    const data = await report(people[0]!.cookie, groupId, { scope: 'analytics' });
    expect(data.periodSummary.totalExpense.paise).toBe(0);
    expect(data.periodSummary.expenseCount).toBe(0);
    expect(data.periodSummary.largestExpense).toBeNull();
    expect(data.relationships).toEqual([]);
    expect(data.recentExpenses).toEqual([]);

    const chart = await report(people[0]!.cookie, groupId, { scope: 'chart' });
    expect(chart.periodBreakdown).toEqual([]);

    const live = await report(people[0]!.cookie, groupId, { scope: 'live' });
    expect(live.balances.netBalance.paise).toBe(0);
  });

  it('blocks a non-member', async () => {
    const { groupId } = await setup(2);
    const mallory = await member('mallory');
    await api()
      .get(`/api/groups/${groupId}/reports/dashboard`)
      .set('Cookie', mallory.cookie)
      .expect(404);
  });

  it('includes the billing cycle when a payday is set', async () => {
    const { groupId, people } = await setup(2);
    await db.update(groups).set({ payday: 5 }).where(eq(groups.id, groupId));

    const live = await report(people[0]!.cookie, groupId, { scope: 'live' });
    expect(live.billingCycle.payday).toBe(5);
    expect(live.billingCycle.nextPayday).toMatch(/^\d{4}-\d{2}-05$/);
  });
});
