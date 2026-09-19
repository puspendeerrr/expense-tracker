import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import { getPairwiseDebts } from '../src/services/balanceService.js';
import {
  TOTAL_BASIS_POINTS,
  distributeByWeights,
  percentToBasisPoints,
  sumPaise,
} from '../src/utils/money.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

/* ========================================================================== */
/* The allocator                                                              */
/* ========================================================================== */

describe('distributeByWeights', () => {
  it('reconciles exactly for an even division', () => {
    expect(distributeByWeights(100_000, [1, 1])).toEqual([50_000, 50_000]);
  });

  it('gives leftover paise to the largest remainder, not the first participant', () => {
    // ₹10.00 split 1:1:98. Floors are 10, 10, 980 -> 1000 total, no leftover.
    const shares = distributeByWeights(1000, [1, 1, 98]);
    expect(sumPaise(shares)).toBe(1000);
    expect(shares).toEqual([10, 10, 980]);
  });

  it('reconciles a three-way percentage exactly', () => {
    // 33.33% of ₹1000 is exactly ₹333.30 -- the basis points divide cleanly here, so
    // nobody is owed a spare paisa.
    const shares = distributeByWeights(100_000, [3333, 3333, 3334]);
    expect(sumPaise(shares)).toBe(100_000);
    expect(shares).toEqual([33_330, 33_330, 33_340]);
  });

  it('hands out a genuine remainder by position when weights tie', () => {
    // ₹1000 in three equal parts: floors are 33333 each, leaving one paisa.
    const shares = distributeByWeights(100_000, [1, 1, 1]);
    expect(sumPaise(shares)).toBe(100_000);
    expect(shares).toEqual([33_334, 33_333, 33_333]);
  });

  it('never loses or invents a paisa across a wide range of inputs', () => {
    for (let amount = 1; amount <= 400; amount += 1) {
      for (const weights of [
        [1, 2],
        [1, 1, 1],
        [1, 2, 3],
        [7, 11, 13, 17],
        [1, 1, 1, 1, 1, 1, 1],
        [9999, 1],
      ]) {
        const shares = distributeByWeights(amount, weights);
        expect(sumPaise(shares)).toBe(amount);
        expect(shares.every((share) => share >= 0)).toBe(true);
        expect(shares).toHaveLength(weights.length);
      }
    }
  });

  it('is deterministic: the same input always allocates identically', () => {
    const first = distributeByWeights(100_001, [1, 1, 1]);
    const second = distributeByWeights(100_001, [1, 1, 1]);
    expect(first).toEqual(second);
  });

  it('tolerates a zero weight without giving that person a paisa', () => {
    const shares = distributeByWeights(100_000, [1, 0, 1]);
    expect(shares[1]).toBe(0);
    expect(sumPaise(shares)).toBe(100_000);
  });

  it('refuses weights that sum to zero rather than dividing by zero', () => {
    expect(() => distributeByWeights(100_000, [0, 0])).toThrow();
  });

  it('refuses a non-integer or negative weight', () => {
    expect(() => distributeByWeights(100_000, [1.5, 1])).toThrow();
    expect(() => distributeByWeights(100_000, [-1, 2])).toThrow();
  });
});

describe('percentToBasisPoints', () => {
  it('converts two-decimal percentages exactly', () => {
    expect(percentToBasisPoints(33.33)).toBe(3333);
    expect(percentToBasisPoints('66.67')).toBe(6667);
    expect(percentToBasisPoints(100)).toBe(TOTAL_BASIS_POINTS);
    expect(percentToBasisPoints(0)).toBe(0);
  });

  it('rejects more precision than it can represent', () => {
    expect(percentToBasisPoints(33.333)).toBeNull();
  });

  it('rejects out-of-range and non-numeric input', () => {
    expect(percentToBasisPoints(-1)).toBeNull();
    expect(percentToBasisPoints(101)).toBeNull();
    expect(percentToBasisPoints('abc')).toBeNull();
  });

  it('adds up to exactly 100% where floating point would not', () => {
    // 33.33 + 33.33 + 33.34 === 100.00000000000001 in float.
    const parts = [33.33, 33.33, 33.34].map((value) => percentToBasisPoints(value)!);
    expect(parts.reduce((total, part) => total + part, 0)).toBe(TOTAL_BASIS_POINTS);
  });
});

/* ========================================================================== */
/* Through the API                                                            */
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

const post = (cookie: string, groupId: string, body: Record<string, unknown>) =>
  api()
    .post(`/api/groups/${groupId}/expenses`)
    .set('Cookie', cookie)
    .send({ title: 'Dinner', expenseDate: TODAY, ...body });

describe('exact splits', () => {
  it('records the amounts the user typed', async () => {
    const { groupId, people } = await setup(2);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 800,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 200 },
        { userId: people[1]!.userId, value: 600 },
      ],
    }).expect(201);

    const shares = res.body.data.expense.participants as Array<{
      userId: string;
      sharePaise: number;
    }>;
    expect(shares.find((s) => s.userId === people[0]!.userId)!.sharePaise).toBe(20_000);
    expect(shares.find((s) => s.userId === people[1]!.userId)!.sharePaise).toBe(60_000);
  });

  it('refuses a split that does not add up to the total', async () => {
    const { groupId, people } = await setup(2);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 800,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 200 },
        { userId: people[1]!.userId, value: 500 },
      ],
    }).expect(400);

    expect(res.body.error.code).toBe('SHARE_RECONCILIATION_FAILED');
    // The message should say what it added up to, not just that it was wrong.
    expect(res.body.error.message).toContain('700');
  });

  it('refuses a share that is off by a single paisa', async () => {
    const { groupId, people } = await setup(2);

    await post(people[0]!.cookie, groupId, {
      amount: 800,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 200 },
        { userId: people[1]!.userId, value: 599.99 },
      ],
    }).expect(400);
  });

  it('rejects sub-paisa precision in a share', async () => {
    const { groupId, people } = await setup(2);

    await post(people[0]!.cookie, groupId, {
      amount: 800,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 200.005 },
        { userId: people[1]!.userId, value: 599.995 },
      ],
    }).expect(400);
  });

  it('allows a participant with a zero share', async () => {
    const { groupId, people } = await setup(2);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 800,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 0 },
        { userId: people[1]!.userId, value: 800 },
      ],
    }).expect(201);

    expect(res.body.data.expense.participantCount).toBe(2);
  });
});

describe('percentage splits', () => {
  it('converts percentages into reconciling paise', async () => {
    const { groupId, people } = await setup(3);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'percentage',
      splits: [
        { userId: people[0]!.userId, value: 33.33 },
        { userId: people[1]!.userId, value: 33.33 },
        { userId: people[2]!.userId, value: 33.34 },
      ],
    }).expect(201);

    const shares = (res.body.data.expense.participants as Array<{ sharePaise: number }>).map(
      (s) => s.sharePaise,
    );
    expect(sumPaise(shares)).toBe(100_000);
  });

  it('remembers the percentage, not just the resolved paise', async () => {
    const { groupId, people } = await setup(2);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'percentage',
      splits: [
        { userId: people[0]!.userId, value: 40 },
        { userId: people[1]!.userId, value: 60 },
      ],
    }).expect(201);

    const shares = res.body.data.expense.participants as Array<{
      userId: string;
      splitValue: number | null;
    }>;
    expect(shares.find((s) => s.userId === people[0]!.userId)!.splitValue).toBe(4000);
    expect(shares.find((s) => s.userId === people[1]!.userId)!.splitValue).toBe(6000);
  });

  it('refuses percentages that do not total 100', async () => {
    const { groupId, people } = await setup(2);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'percentage',
      splits: [
        { userId: people[0]!.userId, value: 40 },
        { userId: people[1]!.userId, value: 50 },
      ],
    }).expect(400);

    expect(res.body.error.code).toBe('SHARE_RECONCILIATION_FAILED');
    expect(res.body.error.message).toContain('90');
  });
});

describe('share splits', () => {
  it('splits by relative weight', async () => {
    const { groupId, people } = await setup(3);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 1200,
      splitType: 'shares',
      splits: [
        { userId: people[0]!.userId, value: 2 },
        { userId: people[1]!.userId, value: 1 },
        { userId: people[2]!.userId, value: 1 },
      ],
    }).expect(201);

    const shares = res.body.data.expense.participants as Array<{
      userId: string;
      sharePaise: number;
    }>;
    expect(shares.find((s) => s.userId === people[0]!.userId)!.sharePaise).toBe(60_000);
    expect(shares.find((s) => s.userId === people[1]!.userId)!.sharePaise).toBe(30_000);
    expect(sumPaise(shares.map((s) => s.sharePaise))).toBe(120_000);
  });

  it('refuses fractional shares', async () => {
    const { groupId, people } = await setup(2);

    await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'shares',
      splits: [
        { userId: people[0]!.userId, value: 1.5 },
        { userId: people[1]!.userId, value: 1 },
      ],
    }).expect(400);
  });

  it('refuses a split where everyone has zero shares', async () => {
    const { groupId, people } = await setup(2);

    await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'shares',
      splits: [
        { userId: people[0]!.userId, value: 0 },
        { userId: people[1]!.userId, value: 0 },
      ],
    }).expect(400);
  });
});

/* ========================================================================== */
/* The outcome that actually matters: the debt                                */
/* ========================================================================== */

describe('unequal splits and the balance engine', () => {
  it('produces a debt matching the share, not an equal one', async () => {
    const { groupId, people } = await setup(2);

    // user0 pays ₹1000; user1's share is 70% of it.
    await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'percentage',
      splits: [
        { userId: people[0]!.userId, value: 30 },
        { userId: people[1]!.userId, value: 70 },
      ],
    }).expect(201);

    const debts = await getPairwiseDebts(groupId);
    expect(debts).toHaveLength(1);
    expect(debts[0]!.debtorId).toBe(people[1]!.userId);
    expect(debts[0]!.creditorId).toBe(people[0]!.userId);
    // 70% of ₹1000, not the ₹500 an equal split would have produced.
    expect(debts[0]!.owedPaise).toBe(70_000);
  });

  it('leaves no debt for someone given a zero share', async () => {
    const { groupId, people } = await setup(3);

    await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 0 },
        { userId: people[1]!.userId, value: 1000 },
        { userId: people[2]!.userId, value: 0 },
      ],
    }).expect(201);

    const debts = await getPairwiseDebts(groupId);
    expect(debts).toHaveLength(1);
    expect(debts[0]!.debtorId).toBe(people[1]!.userId);
    expect(debts[0]!.owedPaise).toBe(100_000);
  });
});

/* ========================================================================== */
/* Rules binding the three fields together                                    */
/* ========================================================================== */

describe('split input rules', () => {
  it('refuses a non-member in a split', async () => {
    const { groupId, people } = await setup(2);
    const outsider = await member('outsider');

    const res = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 500 },
        { userId: outsider.userId, value: 500 },
      ],
    }).expect(400);

    expect(res.body.error.code).toBe('INVALID_PARTICIPANTS');
  });

  it('refuses the same person twice', async () => {
    const { groupId, people } = await setup(2);

    const res = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'exact',
      splits: [
        { userId: people[0]!.userId, value: 500 },
        { userId: people[0]!.userId, value: 500 },
      ],
    }).expect(400);

    expect(res.body.error.code).toBe('INVALID_PARTICIPANTS');
  });

  it('refuses splits on an equal split type', async () => {
    const { groupId, people } = await setup(2);

    await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'everyone',
      splits: [{ userId: people[0]!.userId, value: 1000 }],
    }).expect(400);
  });

  it('refuses participantIds alongside an unequal split', async () => {
    const { groupId, people } = await setup(2);

    await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'exact',
      participantIds: [people[0]!.userId],
      splits: [
        { userId: people[0]!.userId, value: 500 },
        { userId: people[1]!.userId, value: 500 },
      ],
    }).expect(400);
  });

  it('refuses an unequal split with no shares at all', async () => {
    const { groupId, people } = await setup(2);

    await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'exact',
    }).expect(400);
  });

  it('still accepts the original equal splits', async () => {
    const { groupId, people } = await setup(3);

    const everyone = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'everyone',
    }).expect(201);
    expect(everyone.body.data.expense.participantCount).toBe(3);

    const specific = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'specific',
      participantIds: [people[0]!.userId, people[1]!.userId],
    }).expect(201);
    expect(specific.body.data.expense.participantCount).toBe(2);
  });
});

/* ========================================================================== */
/* Editing                                                                    */
/* ========================================================================== */

describe('editing an unequal split', () => {
  const createPercentage = async () => {
    const { groupId, people } = await setup(2);
    const res = await post(people[0]!.cookie, groupId, {
      amount: 1000,
      splitType: 'percentage',
      splits: [
        { userId: people[0]!.userId, value: 40 },
        { userId: people[1]!.userId, value: 60 },
      ],
    }).expect(201);
    return { groupId, people, expenseId: res.body.data.expense.id as string };
  };

  it('keeps the percentages when only the title changes', async () => {
    const { groupId, people, expenseId } = await createPercentage();

    const res = await api()
      .patch(`/api/groups/${groupId}/expenses/${expenseId}`)
      .set('Cookie', people[0]!.cookie)
      .send({ title: 'Renamed' })
      .expect(200);

    const shares = res.body.data.expense.participants as Array<{
      userId: string;
      sharePaise: number;
      splitValue: number | null;
    }>;
    expect(shares.find((s) => s.userId === people[1]!.userId)!.splitValue).toBe(6000);
    expect(shares.find((s) => s.userId === people[1]!.userId)!.sharePaise).toBe(60_000);
  });

  it('reapplies the percentages when the amount changes', async () => {
    const { groupId, people, expenseId } = await createPercentage();

    const res = await api()
      .patch(`/api/groups/${groupId}/expenses/${expenseId}`)
      .set('Cookie', people[0]!.cookie)
      .send({ amount: 2000 })
      .expect(200);

    const shares = res.body.data.expense.participants as Array<{
      userId: string;
      sharePaise: number;
    }>;
    // 60% of the new ₹2000, not the old paise carried over.
    expect(shares.find((s) => s.userId === people[1]!.userId)!.sharePaise).toBe(120_000);
    expect(sumPaise(shares.map((s) => s.sharePaise))).toBe(200_000);
  });

  it('refuses to restate shares without saying which mode they are in', async () => {
    const { groupId, people, expenseId } = await createPercentage();

    await api()
      .patch(`/api/groups/${groupId}/expenses/${expenseId}`)
      .set('Cookie', people[0]!.cookie)
      .send({
        splits: [
          { userId: people[0]!.userId, value: 50 },
          { userId: people[1]!.userId, value: 50 },
        ],
      })
      .expect(400);
  });

  it('converts an unequal split back to equal', async () => {
    const { groupId, people, expenseId } = await createPercentage();

    const res = await api()
      .patch(`/api/groups/${groupId}/expenses/${expenseId}`)
      .set('Cookie', people[0]!.cookie)
      .send({ splitType: 'everyone' })
      .expect(200);

    const shares = res.body.data.expense.participants as Array<{
      sharePaise: number;
      splitValue: number | null;
    }>;
    expect(shares.map((s) => s.sharePaise).sort()).toEqual([50_000, 50_000]);
    expect(shares.every((s) => s.splitValue === null)).toBe(true);
  });
});
