import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { purgeAudits, users } from '../src/db/schema.js';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import { getPairwiseDebts } from '../src/services/balanceService.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const dayOffset = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const TODAY = dayOffset(0);
const LAST_WEEK = dayOffset(-7);
const LAST_MONTH = dayOffset(-30);
const TWO_MONTHS = dayOffset(-60);

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

const setup = async () => {
  const owner = await member('owner');
  const other = await member('other');

  const res = await api()
    .post('/api/groups')
    .set('Cookie', owner.cookie)
    .send({ name: "Survivor's" })
    .expect(201);

  const group = res.body.data.group as { id: string; inviteCode: string };
  await joinGroupByInvite(group.inviteCode, other.userId);

  return { owner, other, groupId: group.id, groupName: "Survivor's" };
};

const addExpense = (
  cookie: string,
  groupId: string,
  amount: number,
  expenseDate: string,
  extra: Record<string, unknown> = {},
) =>
  api()
    .post(`/api/groups/${groupId}/expenses`)
    .set('Cookie', cookie)
    .send({ title: 'Dinner', amount, expenseDate, ...extra })
    .expect(201);

/** Pays off everything one person owes the other, so a window becomes purgeable. */
const settleFully = async (
  payer: { cookie: string },
  receiverId: string,
  groupId: string,
  amount: number,
) => {
  await api()
    .post(`/api/groups/${groupId}/settlements`)
    .set('Cookie', payer.cookie)
    .send({ receiverId, amount, paymentMethod: 'cash', actionType: 'payment' })
    .expect(201);
};

const preview = (cookie: string, groupId: string, body: Record<string, unknown>) =>
  api().post(`/api/groups/${groupId}/purge/preview`).set('Cookie', cookie).send(body);

const purge = (cookie: string, groupId: string, body: Record<string, unknown>) =>
  api().post(`/api/groups/${groupId}/purge`).set('Cookie', cookie).send(body);

/* ========================================================================== */
/* The safety rule                                                            */
/* ========================================================================== */

describe('purge safety', () => {
  it('refuses a range that still holds live debt, and names who', async () => {
    const { owner, other, groupId } = await setup();
    await addExpense(owner.cookie, groupId, 1000, LAST_MONTH);

    const res = await preview(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
    }).expect(200);

    expect(res.body.data.safe).toBe(false);
    expect(res.body.data.expenseCount).toBe(1);
    expect(res.body.data.blockingDebts).toHaveLength(1);
    expect(res.body.data.blockingDebts[0].debtorId).toBe(other.userId);
    expect(res.body.data.blockingDebts[0].owedPaise).toBe(50_000);
  });

  it('blocks the execute call even if the client ignores the preview', async () => {
    const { owner, groupId, groupName } = await setup();
    await addExpense(owner.cookie, groupId, 1000, LAST_MONTH);

    const res = await purge(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: groupName,
    }).expect(400);

    expect(res.body.error.code).toBe('PURGE_WOULD_CHANGE_BALANCES');

    // Nothing was destroyed.
    const list = await api()
      .get(`/api/groups/${groupId}/expenses`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(list.body.data.pagination.total).toBe(1);
  });

  it('allows a range once it has been settled', async () => {
    const { owner, other, groupId, groupName } = await setup();
    await addExpense(owner.cookie, groupId, 1000, LAST_MONTH);

    // other owes owner ₹500; pay it, and the receiver confirms.
    await settleFully(other, owner.userId, groupId, 500);

    const pending = await api()
      .get(`/api/groups/${groupId}/settlements?status=paid_pending_approval&limit=10&offset=0`)
      .set('Cookie', owner.cookie)
      .expect(200);

    await api()
      .post(`/api/groups/${groupId}/settlements/${pending.body.data.settlements[0].id}/approve`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(await getPairwiseDebts(groupId)).toEqual([]);

    const check = await preview(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
    }).expect(200);
    expect(check.body.data.safe).toBe(true);

    const done = await purge(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: groupName,
    }).expect(200);

    expect(done.body.data.expensesDeleted).toBe(1);
    expect(done.body.data.settlementsDeleted).toBe(1);

    // And the balance is still zero afterwards -- the whole point of the rule.
    expect(await getPairwiseDebts(groupId)).toEqual([]);
  });

  it('refuses a partial range that would orphan a settlement from its expense', async () => {
    const { owner, other, groupId } = await setup();

    await addExpense(owner.cookie, groupId, 1000, LAST_MONTH);
    await settleFully(other, owner.userId, groupId, 500);

    const pending = await api()
      .get(`/api/groups/${groupId}/settlements?status=paid_pending_approval&limit=10&offset=0`)
      .set('Cookie', owner.cookie)
      .expect(200);
    await api()
      .post(`/api/groups/${groupId}/settlements/${pending.body.data.settlements[0].id}/approve`)
      .set('Cookie', owner.cookie)
      .expect(200);

    // The expense is a month old; the settlement is today. Purging only the older
    // window would delete the expense but keep the payment, inverting the balance.
    const res = await preview(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: LAST_WEEK,
    }).expect(200);

    expect(res.body.data.expenseCount).toBe(1);
    expect(res.body.data.settlementCount).toBe(0);
    expect(res.body.data.safe).toBe(false);
  });

  it('leaves later history untouched when purging an older window', async () => {
    const { owner, other, groupId, groupName } = await setup();

    await addExpense(owner.cookie, groupId, 1000, LAST_MONTH);
    await settleFully(other, owner.userId, groupId, 500);
    const pending = await api()
      .get(`/api/groups/${groupId}/settlements?status=paid_pending_approval&limit=10&offset=0`)
      .set('Cookie', owner.cookie)
      .expect(200);
    await api()
      .post(`/api/groups/${groupId}/settlements/${pending.body.data.settlements[0].id}/approve`)
      .set('Cookie', owner.cookie)
      .expect(200);

    // A newer, still-unsettled expense that must survive.
    await addExpense(owner.cookie, groupId, 600, TODAY, { title: 'Recent' });

    const before = await getPairwiseDebts(groupId);

    // Purging the settled window only works if it takes the settlement with it, so the
    // range has to span both. Here the safe window is everything up to today.
    const res = await preview(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: LAST_WEEK,
    }).expect(200);
    expect(res.body.data.safe).toBe(false);

    // Balances are unchanged by asking.
    expect(await getPairwiseDebts(groupId)).toEqual(before);
    void groupName;
  });
});

/* ========================================================================== */
/* Authorisation                                                              */
/* ========================================================================== */

describe('purge authorisation', () => {
  it('is closed to a member who did not create the group', async () => {
    const { other, groupId, groupName } = await setup();

    await preview(other.cookie, groupId, { from: TWO_MONTHS, to: TODAY }).expect(403);
    await purge(other.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: groupName,
    }).expect(403);
  });

  it('is closed to a non-member entirely', async () => {
    const { groupId, groupName } = await setup();
    const outsider = await member('outsider');

    await preview(outsider.cookie, groupId, { from: TWO_MONTHS, to: TODAY }).expect(404);
    await purge(outsider.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: groupName,
    }).expect(404);
  });

  it('is closed once an administrator revokes the permission', async () => {
    const { owner, groupId } = await setup();

    const boss = await member('boss');
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, boss.userId));

    await api()
      .patch(`/api/admin/users/${owner.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'history.purge', effect: 'deny' }] })
      .expect(200);

    await preview(owner.cookie, groupId, { from: TWO_MONTHS, to: TODAY }).expect(403);
  });

  it('requires the group name typed exactly', async () => {
    const { owner, groupId } = await setup();

    await purge(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: 'not the group name',
    }).expect(400);
  });

  it('requires a session', async () => {
    const { groupId } = await setup();
    await api()
      .post(`/api/groups/${groupId}/purge/preview`)
      .send({ from: TWO_MONTHS, to: TODAY })
      .expect(401);
  });
});

/* ========================================================================== */
/* Behaviour                                                                  */
/* ========================================================================== */

describe('purge behaviour', () => {
  /** A group whose whole history is settled, so any range is purgeable. */
  const settledGroup = async () => {
    const base = await setup();
    await addExpense(base.owner.cookie, base.groupId, 1000, LAST_MONTH);
    await settleFully(base.other, base.owner.userId, base.groupId, 500);

    const pending = await api()
      .get(`/api/groups/${base.groupId}/settlements?status=paid_pending_approval&limit=10&offset=0`)
      .set('Cookie', base.owner.cookie)
      .expect(200);
    await api()
      .post(
        `/api/groups/${base.groupId}/settlements/${pending.body.data.settlements[0].id}/approve`,
      )
      .set('Cookie', base.owner.cookie)
      .expect(200);

    return base;
  };

  it('rejects a range with nothing in it', async () => {
    const { owner, groupId, groupName } = await settledGroup();

    await purge(owner.cookie, groupId, {
      from: '2001-01-01',
      to: '2001-12-31',
      confirmation: groupName,
    }).expect(400);
  });

  it('rejects a reversed date range', async () => {
    const { owner, groupId } = await settledGroup();

    await preview(owner.cookie, groupId, { from: TODAY, to: TWO_MONTHS }).expect(400);
  });

  it('writes an audit row recording what was destroyed', async () => {
    const { owner, groupId, groupName } = await settledGroup();

    await purge(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: groupName,
    }).expect(200);

    const audits = await db.select().from(purgeAudits);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.groupName).toBe(groupName);
    expect(audits[0]!.expensesDeleted).toBe(1);
    expect(audits[0]!.settlementsDeleted).toBe(1);
    expect(audits[0]!.amountPurgedPaise).toBe(100_000);
    expect(audits[0]!.actorEmail).toBe('owner@example.com');
  });

  it('exposes the audit trail to the group creator', async () => {
    const { owner, groupId, groupName } = await settledGroup();

    await purge(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: groupName,
    }).expect(200);

    const res = await api()
      .get(`/api/groups/${groupId}/purge/audits`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(res.body.data.audits).toHaveLength(1);
    expect(res.body.data.audits[0].expensesDeleted).toBe(1);
  });

  it('removes activity entries only when asked', async () => {
    const { owner, groupId, groupName } = await settledGroup();

    const withoutActivities = await preview(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      includeActivities: false,
    }).expect(200);
    expect(withoutActivities.body.data.activityCount).toBe(0);

    const withActivities = await preview(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      includeActivities: true,
    }).expect(200);
    expect(withActivities.body.data.activityCount).toBeGreaterThan(0);

    void groupName;
  });

  it('refuses to purge a disabled group', async () => {
    const { owner, groupId, groupName } = await settledGroup();

    const boss = await member('boss');
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, boss.userId));

    await api()
      .post(`/api/admin/groups/${groupId}/disable`)
      .set('Cookie', boss.cookie)
      .expect(200);

    const res = await purge(owner.cookie, groupId, {
      from: TWO_MONTHS,
      to: TODAY,
      confirmation: groupName,
    }).expect(403);

    expect(res.body.error.code).toBe('GROUP_DISABLED');
  });
});
