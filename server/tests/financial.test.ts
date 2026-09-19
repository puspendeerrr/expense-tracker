import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { expenseParticipants, expenses, users } from '../src/db/schema.js';
import { closeDatabase, resetAll } from './helpers.js';
import { distributeShares, rupeesToPaise, sumPaise, paiseToRupees } from '../src/utils/money.js';
import { createGroup, joinGroupByInvite } from '../src/services/groupService.js';
import { createExpense, updateExpense, deleteExpense } from '../src/services/expenseService.js';
import {
  approveSettlement,
  createSettlement,
  rejectSettlement,
  cancelSettlement,
} from '../src/services/settlementService.js';
import {
  getOutstandingBetween,
  getPairwiseDebts,
  getUserBalanceSummary,
} from '../src/services/balanceService.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

const makeUser = async (name: string): Promise<string> => {
  const inserted = await db
    .insert(users)
    .values({
      fullName: name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@test.local`,
      passwordHash: 'x',
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  return inserted[0]!.id;
};

/** Builds a group with `count` members and returns their ids, creator first. */
const makeGroup = async (count: number): Promise<{ groupId: string; members: string[] }> => {
  const creator = await makeUser(`Member0_${Date.now()}_${Math.random()}`);
  const { group } = await createGroup({ name: 'Test Group', userId: creator });
  const members = [creator];

  for (let i = 1; i < count; i += 1) {
    const id = await makeUser(`Member${i}_${Date.now()}_${Math.random()}`);
    await joinGroupByInvite(group.inviteCode, id);
    members.push(id);
  }

  return { groupId: group.id, members };
};

const addExpense = (
  groupId: string,
  paidBy: string,
  rupees: number,
  opts: { participantIds?: string[]; actor?: string } = {},
) =>
  createExpense({
    groupId,
    actorUserId: opts.actor ?? paidBy,
    title: `Expense ${rupees}`,
    amountPaise: rupeesToPaise(rupees)!,
    paidBy,
    splitType: opts.participantIds ? 'specific' : 'everyone',
    participantIds: opts.participantIds,
    paymentMode: 'cash',
    expenseDate: TODAY,
  });

/** Independently recomputes every debt from raw rows, to check the SQL engine. */
const recomputeDebtsFromScratch = async (groupId: string) => {
  const rows = await db.execute<{
    debtor: string;
    creditor: string;
    paise: string;
  }>(sql`
    select ep.user_id as debtor, e.paid_by as creditor, sum(ep.share_paise)::bigint as paise
      from expense_participants ep
      join expenses e on e.id = ep.expense_id
     where e.group_id = ${groupId} and ep.user_id <> e.paid_by
     group by 1,2
  `);
  return rows.rows;
};

describe('money primitives', () => {
  it('parses rupees to exact paise', () => {
    expect(rupeesToPaise(450.75)).toBe(45075);
    expect(rupeesToPaise('1000')).toBe(100000);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(45.075)).toBeNull();
    expect(rupeesToPaise('abc')).toBeNull();
    expect(rupeesToPaise(Infinity)).toBeNull();
  });

  it('distributes 1000 rupees across 3 people with zero drift', () => {
    const shares = distributeShares(100000, 3);
    expect(shares).toEqual([33334, 33333, 33333]);
    expect(sumPaise(shares)).toBe(100000);
  });

  it('reconciles exactly for every participant count from 1 to 50', () => {
    for (let n = 1; n <= 50; n += 1) {
      for (const amount of [1, 7, 100, 99999, 100000, 123457]) {
        const shares = distributeShares(amount, n);
        expect(sumPaise(shares), `amount=${amount} n=${n}`).toBe(amount);
        // No share may differ from another by more than one paisa.
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('handles the smallest possible expense', () => {
    const shares = distributeShares(1, 3);
    expect(sumPaise(shares)).toBe(1);
    expect(shares).toEqual([1, 0, 0]);
  });

  it('handles very large amounts without precision loss', () => {
    const amount = rupeesToPaise(10_000_000)!;
    const shares = distributeShares(amount, 7);
    expect(sumPaise(shares)).toBe(amount);
    expect(paiseToRupees(amount)).toBe(10_000_000);
  });
});

describe('expense reconciliation', () => {
  it('stores shares that sum exactly to the expense total', async () => {
    const { groupId, members } = await makeGroup(3);
    const expense = await addExpense(groupId, members[0]!, 1000);

    const rows = await db
      .select()
      .from(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expense.id));

    expect(rows).toHaveLength(3);
    expect(sumPaise(rows.map((r) => r.sharePaise))).toBe(100000);
    expect(rows.map((r) => r.sharePaise).sort((a, b) => b - a)).toEqual([33334, 33333, 33333]);
  });

  it('reconciles after an edit — the bug that lost paise in the reference', async () => {
    const { groupId, members } = await makeGroup(3);
    const expense = await addExpense(groupId, members[0]!, 1000);

    await updateExpense({
      expenseId: expense.id,
      groupId,
      actorUserId: members[0]!,
      amountPaise: rupeesToPaise(1000)!,
      title: 'Edited',
    });

    const rows = await db
      .select()
      .from(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expense.id));

    // The reference produced 333.33 x 3 = 999.99 here. Must be exact.
    expect(sumPaise(rows.map((r) => r.sharePaise))).toBe(100000);
  });

  it('reconciles across every amount/size combination after edit', async () => {
    const { groupId, members } = await makeGroup(4);
    const expense = await addExpense(groupId, members[0]!, 10);

    for (const rupees of [1000, 0.03, 333.33, 99999.99, 7]) {
      await updateExpense({
        expenseId: expense.id,
        groupId,
        actorUserId: members[0]!,
        amountPaise: rupeesToPaise(rupees)!,
      });

      const rows = await db
        .select()
        .from(expenseParticipants)
        .where(eq(expenseParticipants.expenseId, expense.id));

      expect(sumPaise(rows.map((r) => r.sharePaise)), `rupees=${rupees}`).toBe(
        rupeesToPaise(rupees),
      );
    }
  });

  it('rejects a payer who is not in the group', async () => {
    const { groupId, members } = await makeGroup(2);
    const outsider = await makeUser('Outsider');

    await expect(addExpense(groupId, outsider, 100, { actor: members[0]! })).rejects.toMatchObject({
      code: 'PAYER_NOT_IN_GROUP',
    });
  });

  it('rejects a participant who is not in the group — including on edit', async () => {
    const { groupId, members } = await makeGroup(2);
    const outsider = await makeUser('Outsider2');
    const expense = await addExpense(groupId, members[0]!, 100);

    // The reference skipped membership validation entirely on the edit path.
    await expect(
      updateExpense({
        expenseId: expense.id,
        groupId,
        actorUserId: members[0]!,
        splitType: 'specific',
        participantIds: [members[0]!, outsider],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PARTICIPANTS' });
  });

  it('refuses an empty participant list', async () => {
    const { groupId, members } = await makeGroup(2);
    await expect(
      addExpense(groupId, members[0]!, 100, { participantIds: [] }),
    ).rejects.toMatchObject({ code: 'INVALID_PARTICIPANTS' });
  });

  it('only lets the payer edit or delete', async () => {
    const { groupId, members } = await makeGroup(3);
    const expense = await addExpense(groupId, members[0]!, 100);

    await expect(
      updateExpense({ expenseId: expense.id, groupId, actorUserId: members[1]!, title: 'Hijack' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(deleteExpense(expense.id, groupId, members[1]!)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('keeps historical shares frozen when a new member joins', async () => {
    const { groupId, members } = await makeGroup(2);
    const expense = await addExpense(groupId, members[0]!, 100);

    const before = await db
      .select()
      .from(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expense.id));
    expect(before).toHaveLength(2);

    const newcomer = await makeUser('Latecomer');
    const groupRow = await db.query.groups.findFirst({ where: (g, { eq: e }) => e(g.id, groupId) });
    await joinGroupByInvite(groupRow!.inviteCode, newcomer);

    const after = await db
      .select()
      .from(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expense.id));

    // Historical attribution must not be rewritten by a membership change.
    expect(after).toHaveLength(2);
    expect(sumPaise(after.map((r) => r.sharePaise))).toBe(10000);
  });
});

describe('balance engine', () => {
  it('derives a simple two-person debt', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];

    await addExpense(groupId, alice, 1000);

    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(50000);
    expect(await getOutstandingBetween(groupId, alice, bob)).toBe(0);

    const summary = await getUserBalanceSummary(groupId, alice);
    expect(summary.youWillReceiveTotalPaise).toBe(50000);
    expect(summary.youNeedToPayTotalPaise).toBe(0);
    expect(summary.netBalancePaise).toBe(50000);
  });

  it('preserves both directions and never nets them', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];

    // Alice pays 1000 (Bob owes 500); Bob pays 400 (Alice owes 200).
    await addExpense(groupId, alice, 1000);
    await addExpense(groupId, bob, 400);

    const bobOwes = await getOutstandingBetween(groupId, bob, alice);
    const aliceOwes = await getOutstandingBetween(groupId, alice, bob);

    // Both survive independently — not collapsed into a single ₹300.
    expect(bobOwes).toBe(50000);
    expect(aliceOwes).toBe(20000);

    const debts = await getPairwiseDebts(groupId);
    expect(debts).toHaveLength(2);
  });

  it('matches an independent recomputation from raw rows', async () => {
    const { groupId, members } = await makeGroup(4);
    const [a, b, c, d] = members as [string, string, string, string];

    await addExpense(groupId, a, 1000);
    await addExpense(groupId, b, 333.33);
    await addExpense(groupId, c, 0.03);
    await addExpense(groupId, d, 99999.99);
    await addExpense(groupId, a, 250, { participantIds: [a, b] });
    await addExpense(groupId, b, 75, { participantIds: [c] });

    const engine = await getPairwiseDebts(groupId);
    const raw = await recomputeDebtsFromScratch(groupId);

    const engineMap = new Map(engine.map((d2) => [`${d2.debtorId}->${d2.creditorId}`, d2.owedPaise]));
    for (const row of raw) {
      // The engine omits non-positive debts, so an absent key means zero. A zero row is
      // legitimate: ₹0.03 across 4 people allocates [1,1,1,0] paise.
      expect(engineMap.get(`${row.debtor}->${row.creditor}`) ?? 0).toBe(Number(row.paise));
    }
  });

  it('total debt equals total credit across the whole group', async () => {
    const { groupId, members } = await makeGroup(5);
    for (let i = 0; i < 5; i += 1) {
      await addExpense(groupId, members[i]!, 100 * (i + 1) + 0.07);
    }

    const debts = await getPairwiseDebts(groupId);
    const totalOwed = sumPaise(debts.map((d) => d.owedPaise));

    let sumOfPerUserOwes = 0;
    let sumOfPerUserReceives = 0;
    for (const member of members) {
      const summary = await getUserBalanceSummary(groupId, member);
      sumOfPerUserOwes += summary.youNeedToPayTotalPaise;
      sumOfPerUserReceives += summary.youWillReceiveTotalPaise;
    }

    expect(sumOfPerUserOwes).toBe(totalOwed);
    expect(sumOfPerUserReceives).toBe(totalOwed);
  });

  it('removes an expense from the graph when it is deleted', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];

    const expense = await addExpense(groupId, alice, 1000);
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(50000);

    await deleteExpense(expense.id, groupId, alice);

    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(0);
    expect(await getPairwiseDebts(groupId)).toHaveLength(0);
    // Participant rows must cascade, leaving no orphan financial state.
    expect(await db.select().from(expenseParticipants)).toHaveLength(0);
  });

  it('reflects an edited amount in the balance', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];

    const expense = await addExpense(groupId, alice, 1000);
    await updateExpense({
      expenseId: expense.id,
      groupId,
      actorUserId: alice,
      amountPaise: rupeesToPaise(500)!,
    });

    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(25000);
  });
});

describe('settlements and balances', () => {
  it('only a completed settlement reduces a balance', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];
    await addExpense(groupId, alice, 1000);

    const settlement = await createSettlement({
      groupId,
      payerId: bob,
      receiverId: alice,
      amountPaise: 50000,
      paymentMethod: 'cash',
      actionType: 'payment',
    });

    // Pending: balance untouched.
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(50000);

    await approveSettlement(settlement.id, groupId, alice);
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(0);
  });

  it('rejected, cancelled and will-pay-soon never move a balance', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];
    await addExpense(groupId, alice, 1000);

    const rejected = await createSettlement({
      groupId, payerId: bob, receiverId: alice, amountPaise: 10000,
      paymentMethod: 'cash', actionType: 'payment',
    });
    await rejectSettlement(rejected.id, groupId, alice, 'Never received');
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(50000);

    const promise = await createSettlement({
      groupId, payerId: bob, receiverId: alice, amountPaise: 10000,
      paymentMethod: 'cash', actionType: 'will_pay_soon',
    });
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(50000);

    await cancelSettlement(promise.id, groupId, bob);
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(50000);
  });

  it('supports partial settlement', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];
    await addExpense(groupId, alice, 1000);

    const first = await createSettlement({
      groupId, payerId: bob, receiverId: alice, amountPaise: 20000,
      paymentMethod: 'cash', actionType: 'payment',
    });
    await approveSettlement(first.id, groupId, alice);
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(30000);

    const second = await createSettlement({
      groupId, payerId: bob, receiverId: alice, amountPaise: 30000,
      paymentMethod: 'cash', actionType: 'payment',
    });
    await approveSettlement(second.id, groupId, alice);
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(0);
  });

  it('rejects an over-settlement instead of destroying money', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];
    await addExpense(groupId, alice, 600); // Bob owes 300.

    await expect(
      createSettlement({
        groupId, payerId: bob, receiverId: alice, amountPaise: 50000,
        paymentMethod: 'cash', actionType: 'payment',
      }),
    ).rejects.toMatchObject({ code: 'SETTLEMENT_EXCEEDS_DEBT' });

    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(30000);
  });

  it('rejects settling a debt that does not exist', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];

    await expect(
      createSettlement({
        groupId, payerId: bob, receiverId: alice, amountPaise: 100,
        paymentMethod: 'cash', actionType: 'payment',
      }),
    ).rejects.toMatchObject({ code: 'SETTLEMENT_EXCEEDS_DEBT' });
  });

  it('rejects a receiver outside the group', async () => {
    const { groupId, members } = await makeGroup(2);
    const outsider = await makeUser('Stranger');

    await expect(
      createSettlement({
        groupId, payerId: members[1]!, receiverId: outsider, amountPaise: 100,
        paymentMethod: 'cash', actionType: 'payment',
      }),
    ).rejects.toMatchObject({ code: 'NOT_GROUP_MEMBER' });
  });

  it('requires proof for UPI settlements', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];
    await addExpense(groupId, alice, 1000);

    await expect(
      createSettlement({
        groupId, payerId: bob, receiverId: alice, amountPaise: 10000,
        paymentMethod: 'upi', actionType: 'payment',
      }),
    ).rejects.toMatchObject({ code: 'SETTLEMENT_PROOF_REQUIRED' });
  });

  it('lets only the receiver approve, and only once', async () => {
    const { groupId, members } = await makeGroup(3);
    const [alice, bob, carol] = members as [string, string, string];
    await addExpense(groupId, alice, 900);

    const settlement = await createSettlement({
      groupId, payerId: bob, receiverId: alice, amountPaise: 30000,
      paymentMethod: 'cash', actionType: 'payment',
    });

    await expect(approveSettlement(settlement.id, groupId, bob)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(approveSettlement(settlement.id, groupId, carol)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    await approveSettlement(settlement.id, groupId, alice);

    // Double-approval must not double-reduce the balance.
    await expect(approveSettlement(settlement.id, groupId, alice)).rejects.toMatchObject({
      code: 'SETTLEMENT_INVALID_STATE',
    });
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(0);
  });

  it('lets only one of two concurrent approvals win', async () => {
    const { groupId, members } = await makeGroup(2);
    const [alice, bob] = members as [string, string];
    await addExpense(groupId, alice, 1000);

    const settlement = await createSettlement({
      groupId, payerId: bob, receiverId: alice, amountPaise: 50000,
      paymentMethod: 'cash', actionType: 'payment',
    });

    const results = await Promise.allSettled([
      approveSettlement(settlement.id, groupId, alice),
      approveSettlement(settlement.id, groupId, alice),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(0);
  });

  it('reconciles a full multi-party scenario end to end', async () => {
    const { groupId, members } = await makeGroup(3);
    const [alice, bob, carol] = members as [string, string, string];

    // ₹900 three ways: Bob and Carol each owe Alice ₹300.
    await addExpense(groupId, alice, 900);
    // ₹600 between Bob and Carol: Carol owes Bob ₹300.
    await addExpense(groupId, bob, 600, { participantIds: [bob, carol] });

    expect(await getOutstandingBetween(groupId, bob, alice)).toBe(30000);
    expect(await getOutstandingBetween(groupId, carol, alice)).toBe(30000);
    expect(await getOutstandingBetween(groupId, carol, bob)).toBe(30000);

    const s1 = await createSettlement({
      groupId, payerId: carol, receiverId: alice, amountPaise: 30000,
      paymentMethod: 'cash', actionType: 'payment',
    });
    await approveSettlement(s1.id, groupId, alice);

    const carolSummary = await getUserBalanceSummary(groupId, carol);
    expect(carolSummary.youNeedToPayTotalPaise).toBe(30000); // still owes Bob
    expect(carolSummary.youWillReceiveTotalPaise).toBe(0);

    const aliceSummary = await getUserBalanceSummary(groupId, alice);
    expect(aliceSummary.youWillReceiveTotalPaise).toBe(30000); // Bob only

    // Every remaining debt still reconciles against raw rows.
    const debts = await getPairwiseDebts(groupId);
    expect(sumPaise(debts.map((d) => d.owedPaise))).toBe(60000);
  });
});

/**
 * Drizzle wraps driver errors, so the trigger's own message lives on `cause`.
 * Walking the chain keeps these assertions about the database's behaviour rather than
 * about Drizzle's error formatting.
 */
const rootMessage = (error: unknown): string => {
  let current: unknown = error;
  const seen: string[] = [];
  while (current instanceof Error) {
    seen.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }
  return seen.join(' | ');
};

const expectRejectionMatching = async (
  operation: Promise<unknown>,
  pattern: RegExp,
): Promise<void> => {
  let caught: unknown;
  try {
    await operation;
  } catch (error: unknown) {
    caught = error;
  }
  expect(caught, 'expected the operation to be rejected').toBeDefined();
  expect(rootMessage(caught)).toMatch(pattern);
};

describe('database-level reconciliation guarantee', () => {
  it('refuses to commit a drifted split even when bypassing the service', async () => {
    const { groupId, members } = await makeGroup(3);
    const expense = await addExpense(groupId, members[0]!, 1000);

    // Simulate the reference's buggy edit path writing directly to the table:
    // 33333 x 3 = 99999, one paisa short of the 100000 total.
    await expectRejectionMatching(
      db.transaction(async (tx) => {
        await tx.delete(expenseParticipants).where(eq(expenseParticipants.expenseId, expense.id));
        await tx.insert(expenseParticipants).values(
          members.map((userId) => ({ expenseId: expense.id, userId, sharePaise: 33333 })),
        );
      }),
      /reconciliation failed/i,
    );

    // The original, correct split is still intact.
    const rows = await db
      .select()
      .from(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expense.id));
    expect(sumPaise(rows.map((r) => r.sharePaise))).toBe(100000);
  });

  it('refuses an expense with no participants', async () => {
    const { groupId, members } = await makeGroup(2);

    await expectRejectionMatching(
      db.insert(expenses).values({
        groupId,
        title: 'Orphan',
        amountPaise: 5000,
        paidBy: members[0]!,
        expenseDate: TODAY,
        createdBy: members[0]!,
      }),
      /no participants/i,
    );
  });
});
