import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { adminAudits, groupMembers, groups, users } from '../src/db/schema.js';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import { getPairwiseDebts } from '../src/services/balanceService.js';
import { stripSecrets } from '../src/services/auditService.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId, email: `${name}@example.com` };
};

const admin = async (name: string) => {
  const person = await member(name);
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, person.userId));
  return person;
};

/** Owner + two members, one expense, so there is real financial state to protect. */
const scenario = async () => {
  const owner = await member('owner');
  const second = await member('second');
  const third = await member('third');
  const boss = await admin('boss');

  const res = await api()
    .post('/api/groups')
    .set('Cookie', owner.cookie)
    .send({ name: 'Flat 402' })
    .expect(201);

  const group = res.body.data.group as { id: string; inviteCode: string };
  await joinGroupByInvite(group.inviteCode, second.userId);
  await joinGroupByInvite(group.inviteCode, third.userId);

  const expense = await api()
    .post(`/api/groups/${group.id}/expenses`)
    .set('Cookie', owner.cookie)
    .send({ title: 'Dinner', amount: 900, expenseDate: TODAY })
    .expect(201);

  return {
    owner,
    second,
    third,
    boss,
    groupId: group.id,
    expenseId: expense.body.data.expense.id as string,
  };
};

/* ========================================================================== */
/* Secret handling                                                            */
/* ========================================================================== */

describe('audit secret stripping', () => {
  it('redacts credential-shaped keys at any depth', () => {
    const cleaned = stripSecrets({
      password: 'hunter2',
      nested: { newPassword: 'x', otp: '123456', fine: 'keep' },
      list: [{ apiKey: 'k' }],
      confirmPassword: 'y',
      session_token: 'z',
    }) as Record<string, unknown>;

    expect(cleaned.password).toBe('[redacted]');
    expect(cleaned.confirmPassword).toBe('[redacted]');
    expect(cleaned.session_token).toBe('[redacted]');
    expect((cleaned.nested as Record<string, unknown>).newPassword).toBe('[redacted]');
    expect((cleaned.nested as Record<string, unknown>).otp).toBe('[redacted]');
    expect((cleaned.nested as Record<string, unknown>).fine).toBe('keep');
    expect(((cleaned.list as unknown[])[0] as Record<string, unknown>).apiKey).toBe('[redacted]');
  });

  it('leaves ordinary domain values alone', () => {
    const cleaned = stripSecrets({ amountPaise: 1000, title: 'Dinner' }) as Record<string, unknown>;
    expect(cleaned.amountPaise).toBe(1000);
    expect(cleaned.title).toBe('Dinner');
  });
});

/* ========================================================================== */
/* Audit trail                                                                */
/* ========================================================================== */

describe('admin audit trail', () => {
  it('records a role change with the actor and target', async () => {
    const { second, boss } = await scenario();

    await api()
      .patch(`/api/admin/users/${second.userId}/role`)
      .set('Cookie', boss.cookie)
      .send({ role: 'admin' })
      .expect(200);

    const rows = await db
      .select()
      .from(adminAudits)
      .where(eq(adminAudits.action, 'user.role_changed'));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorEmail).toBe('boss@example.com');
    expect(rows[0]!.targetId).toBe(second.userId);
    expect(rows[0]!.metadata).toMatchObject({ newRole: 'admin' });
  });

  it('records a password reset without recording the password', async () => {
    const { second, boss } = await scenario();

    await api()
      .post(`/api/admin/users/${second.userId}/password`)
      .set('Cookie', boss.cookie)
      .send({ password: 'BrandNewPass8' })
      .expect(200);

    const rows = await db
      .select()
      .from(adminAudits)
      .where(eq(adminAudits.action, 'user.password_reset'));

    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0]!.metadata)).not.toContain('BrandNewPass8');
  });

  it('exposes the trail through the API with filters', async () => {
    const { second, boss } = await scenario();

    await api()
      .post(`/api/admin/users/${second.userId}/disable`)
      .set('Cookie', boss.cookie)
      .send({ reason: 'Testing' })
      .expect(200);

    const all = await api()
      .get('/api/admin/audit?limit=25&offset=0')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(all.body.data.audits.length).toBeGreaterThan(0);

    const filtered = await api()
      .get('/api/admin/audit?limit=25&offset=0&action=user.disabled')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(filtered.body.data.audits).toHaveLength(1);
    expect(filtered.body.data.audits[0].targetLabel).toBe('second@example.com');

    const empty = await api()
      .get('/api/admin/audit?limit=25&offset=0&action=group.deleted')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(empty.body.data.audits).toEqual([]);
  });

  it('lists the distinct actions actually present', async () => {
    const { second, boss } = await scenario();

    await api()
      .post(`/api/admin/users/${second.userId}/revoke-sessions`)
      .set('Cookie', boss.cookie)
      .expect(200);

    const res = await api()
      .get('/api/admin/audit/actions')
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(res.body.data.actions).toContain('user.sessions_revoked');
  });
});

/* ========================================================================== */
/* Group detail and creator transfer                                          */
/* ========================================================================== */

describe('admin group detail', () => {
  it('reports stats and debts from the balance engine', async () => {
    const { groupId, boss } = await scenario();

    const res = await api()
      .get(`/api/admin/groups/${groupId}`)
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(res.body.data.stats.memberCount).toBe(3);
    expect(res.body.data.stats.expenseCount).toBe(1);

    // The admin view must agree with the engine exactly.
    const engine = await getPairwiseDebts(groupId);
    expect(res.body.data.debts).toHaveLength(engine.length);
    expect(res.body.data.stats.openDebtValuePaise).toBe(
      engine.reduce((total, debt) => total + debt.owedPaise, 0),
    );
  });
});

describe('creator transfer', () => {
  it('moves ownership and swaps the roles atomically', async () => {
    const { groupId, second, boss } = await scenario();

    await api()
      .post(`/api/admin/groups/${groupId}/transfer-creator`)
      .set('Cookie', boss.cookie)
      .send({ newCreatorId: second.userId })
      .expect(200);

    const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    expect(group[0]!.createdBy).toBe(second.userId);

    const memberships = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    const creators = memberships.filter((m) => m.role === 'creator');
    expect(creators).toHaveLength(1);
    expect(creators[0]!.userId).toBe(second.userId);
  });

  it('refuses someone who is not a member', async () => {
    const { groupId, boss } = await scenario();
    const outsider = await member('outsider');

    const res = await api()
      .post(`/api/admin/groups/${groupId}/transfer-creator`)
      .set('Cookie', boss.cookie)
      .send({ newCreatorId: outsider.userId })
      .expect(400);

    expect(res.body.error.message).toContain('already be a member');
  });

  it('refuses a disabled account', async () => {
    const { groupId, second, boss } = await scenario();

    await api()
      .post(`/api/admin/users/${second.userId}/disable`)
      .set('Cookie', boss.cookie)
      .send({})
      .expect(200);

    await api()
      .post(`/api/admin/groups/${groupId}/transfer-creator`)
      .set('Cookie', boss.cookie)
      .send({ newCreatorId: second.userId })
      .expect(400);
  });

  it('refuses transferring to the current owner', async () => {
    const { groupId, owner, boss } = await scenario();

    await api()
      .post(`/api/admin/groups/${groupId}/transfer-creator`)
      .set('Cookie', boss.cookie)
      .send({ newCreatorId: owner.userId })
      .expect(400);
  });

  it('writes an audit row naming both parties', async () => {
    const { groupId, second, boss } = await scenario();

    await api()
      .post(`/api/admin/groups/${groupId}/transfer-creator`)
      .set('Cookie', boss.cookie)
      .send({ newCreatorId: second.userId })
      .expect(200);

    const rows = await db
      .select()
      .from(adminAudits)
      .where(eq(adminAudits.action, 'group.creator_transferred'));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.metadata).toMatchObject({ newCreatorId: second.userId });
  });
});

/* ========================================================================== */
/* Expense and settlement operations                                          */
/* ========================================================================== */

describe('admin expense operations', () => {
  it('deletes an expense the admin did not pay for', async () => {
    const { expenseId, groupId, boss } = await scenario();

    await api()
      .delete(`/api/admin/expenses/${expenseId}`)
      .set('Cookie', boss.cookie)
      .expect(200);

    // Balances are derived, so removing the expense removes its whole contribution.
    expect(await getPairwiseDebts(groupId)).toEqual([]);
  });

  it('records the deletion with the amount and payer', async () => {
    const { expenseId, boss } = await scenario();

    await api()
      .delete(`/api/admin/expenses/${expenseId}`)
      .set('Cookie', boss.cookie)
      .expect(200);

    const rows = await db
      .select()
      .from(adminAudits)
      .where(eq(adminAudits.action, 'expense.deleted'));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.targetLabel).toBe('Dinner');
    expect(rows[0]!.metadata).toMatchObject({ amountPaise: 90_000 });
  });

  it('404s for an unknown expense', async () => {
    const { boss } = await scenario();

    await api()
      .delete('/api/admin/expenses/11111111-1111-4111-8111-111111111111')
      .set('Cookie', boss.cookie)
      .expect(404);
  });
});

describe('admin settlement operations', () => {
  const withSettlement = async () => {
    const base = await scenario();

    const created = await api()
      .post(`/api/groups/${base.groupId}/settlements`)
      .set('Cookie', base.second.cookie)
      .send({
        receiverId: base.owner.userId,
        amount: 100,
        paymentMethod: 'cash',
        actionType: 'payment',
      })
      .expect(201);

    return { ...base, settlementId: created.body.data.settlement.id as string };
  };

  it('lists settlements with the live outstanding debt', async () => {
    const { boss } = await withSettlement();

    const res = await api()
      .get('/api/admin/settlements?limit=25&offset=0')
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(res.body.data.settlements).toHaveLength(1);
    const row = res.body.data.settlements[0];
    expect(row.amountPaise).toBe(10_000);
    // Pending settlements do not move a balance, so the full ₹300 share is outstanding.
    expect(row.outstandingPaise).toBe(30_000);
  });

  it('cancels a settlement the admin is not party to', async () => {
    const { settlementId, boss } = await withSettlement();

    const res = await api()
      .post(`/api/admin/settlements/${settlementId}/cancel`)
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(res.body.data.settlement.status).toBe('cancelled');

    const rows = await db
      .select()
      .from(adminAudits)
      .where(eq(adminAudits.action, 'settlement.cancelled'));
    expect(rows).toHaveLength(1);
  });

  it('filters by status', async () => {
    const { boss } = await withSettlement();

    const none = await api()
      .get('/api/admin/settlements?limit=25&offset=0&status=completed')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(none.body.data.settlements).toEqual([]);

    const pending = await api()
      .get('/api/admin/settlements?limit=25&offset=0&status=paid_pending_approval')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(pending.body.data.settlements).toHaveLength(1);
  });
});

/* ========================================================================== */
/* Authorisation                                                              */
/* ========================================================================== */

describe('admin console authorisation', () => {
  it('refuses every admin route without a session', async () => {
    const { groupId, expenseId } = await scenario();

    await api().get('/api/admin/stats').expect(401);
    await api().get(`/api/admin/groups/${groupId}`).expect(401);
    await api().get('/api/admin/audit').expect(401);
    await api().delete(`/api/admin/expenses/${expenseId}`).expect(401);
    await api().get('/api/admin/settlements').expect(401);
  });

  it('refuses an ordinary member everywhere', async () => {
    const { groupId, expenseId, owner } = await scenario();

    await api().get('/api/admin/stats').set('Cookie', owner.cookie).expect(403);
    await api().get(`/api/admin/groups/${groupId}`).set('Cookie', owner.cookie).expect(403);
    await api().get('/api/admin/audit').set('Cookie', owner.cookie).expect(403);
    await api()
      .delete(`/api/admin/expenses/${expenseId}`)
      .set('Cookie', owner.cookie)
      .expect(403);
  });

  it('lets a read-only console user look but not mutate', async () => {
    const { groupId, expenseId, second, boss } = await scenario();

    // admin.access alone: the console opens, the narrower gates stay shut.
    await api()
      .patch(`/api/admin/users/${second.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'admin.access', effect: 'allow' }] })
      .expect(200);

    await api().get('/api/admin/stats').set('Cookie', second.cookie).expect(200);
    await api().get(`/api/admin/groups/${groupId}`).set('Cookie', second.cookie).expect(200);
    await api().get('/api/admin/audit').set('Cookie', second.cookie).expect(200);

    await api()
      .delete(`/api/admin/expenses/${expenseId}`)
      .set('Cookie', second.cookie)
      .expect(403);
    await api()
      .post(`/api/admin/groups/${groupId}/transfer-creator`)
      .set('Cookie', second.cookie)
      .send({ newCreatorId: second.userId })
      .expect(403);
    await api()
      .post(`/api/admin/users/${second.userId}/disable`)
      .set('Cookie', second.cookie)
      .send({})
      .expect(403);
  });

  it('does not let a disabled admin keep using the console', async () => {
    const { boss } = await scenario();
    const other = await admin('other');

    await api()
      .post(`/api/admin/users/${boss.userId}/disable`)
      .set('Cookie', other.cookie)
      .send({})
      .expect(200);

    await api().get('/api/admin/stats').set('Cookie', boss.cookie).expect(401);
  });
});

/* ========================================================================== */
/* Search and activity                                                        */
/* ========================================================================== */

describe('admin search and activity', () => {
  it('finds users, groups and expenses', async () => {
    const { boss } = await scenario();

    const res = await api()
      .get('/api/admin/search?q=Flat')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(res.body.data.groups.length).toBeGreaterThan(0);

    const byExpense = await api()
      .get('/api/admin/search?q=Dinner')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(byExpense.body.data.expenses.length).toBeGreaterThan(0);
  });

  it('rejects an empty search term', async () => {
    const { boss } = await scenario();
    await api().get('/api/admin/search?q=').set('Cookie', boss.cookie).expect(400);
  });

  it('returns platform activity with group and actor attached', async () => {
    const { boss, groupId } = await scenario();

    const res = await api()
      .get('/api/admin/activity?limit=25&offset=0')
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(res.body.data.activities.length).toBeGreaterThan(0);
    const row = res.body.data.activities[0];
    expect(row.group).toBeTruthy();
    expect(row.actor.email).toBeTruthy();

    const scoped = await api()
      .get(`/api/admin/activity?limit=25&offset=0&groupId=${groupId}`)
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(scoped.body.data.activities.length).toBeGreaterThan(0);
  });

  it('filters activity by type', async () => {
    const { boss } = await scenario();

    const res = await api()
      .get('/api/admin/activity?limit=25&offset=0&type=expense_created')
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(res.body.data.activities.length).toBeGreaterThan(0);
    for (const row of res.body.data.activities) expect(row.type).toBe('expense_created');
  });
});

/* ========================================================================== */
/* Status filters                                                             */
/* ========================================================================== */

describe('status filtering', () => {
  it('narrows the user list to disabled accounts, and back again', async () => {
    const { boss, second } = await scenario();

    const all = await api().get('/api/admin/users').set('Cookie', boss.cookie).expect(200);
    const totalBefore = all.body.data.pagination.total as number;
    expect(totalBefore).toBeGreaterThan(1);

    await api()
      .post(`/api/admin/users/${second.userId}/disable`)
      .set('Cookie', boss.cookie)
      .send({ reason: 'testing' })
      .expect(200);

    const disabled = await api()
      .get('/api/admin/users?status=disabled')
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(disabled.body.data.pagination.total).toBe(1);
    expect(disabled.body.data.users[0].id).toBe(second.userId);

    const active = await api()
      .get('/api/admin/users?status=active')
      .set('Cookie', boss.cookie)
      .expect(200);

    expect(active.body.data.pagination.total).toBe(totalBefore - 1);
    expect(
      (active.body.data.users as { id: string }[]).some((row) => row.id === second.userId),
    ).toBe(false);
  });

  it('narrows the group list to disabled groups', async () => {
    const { boss, groupId } = await scenario();

    await api()
      .post(`/api/admin/groups/${groupId}/disable`)
      .set('Cookie', boss.cookie)
      .expect(200);

    const disabled = await api()
      .get('/api/admin/groups?status=disabled')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(disabled.body.data.pagination.total).toBe(1);

    const active = await api()
      .get('/api/admin/groups?status=active')
      .set('Cookie', boss.cookie)
      .expect(200);
    expect(active.body.data.pagination.total).toBe(0);
  });

  it('rejects a status value that is not a real account status', async () => {
    const { boss } = await scenario();
    await api()
      .get('/api/admin/users?status=deleted')
      .set('Cookie', boss.cookie)
      .expect(400);
  });
});

/* ========================================================================== */
/* Admin history purge                                                        */
/* ========================================================================== */

describe('admin history purge', () => {
  it('refuses a non-admin outright', async () => {
    const { second, groupId } = await scenario();

    await api()
      .post(`/api/admin/groups/${groupId}/purge/preview`)
      .set('Cookie', second.cookie)
      .send({ from: TODAY, to: TODAY })
      .expect(403);
  });

  it('previews without deleting anything', async () => {
    const { boss, groupId, owner } = await scenario();

    const preview = await api()
      .post(`/api/admin/groups/${groupId}/purge/preview`)
      .set('Cookie', boss.cookie)
      .send({ from: TODAY, to: TODAY })
      .expect(200);

    expect(preview.body.data.expenseCount).toBe(1);

    // The expense is still there: a preview must never be a disguised delete.
    const after = await api()
      .get(`/api/groups/${groupId}/expenses`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(after.body.data.expenses).toHaveLength(1);
  });

  it('refuses a range that would move a balance, even for an admin', async () => {
    const { boss, groupId } = await scenario();

    // The single expense is unsettled, so removing it moves what people owe.
    const preview = await api()
      .post(`/api/admin/groups/${groupId}/purge/preview`)
      .set('Cookie', boss.cookie)
      .send({ from: TODAY, to: TODAY })
      .expect(200);

    expect(preview.body.data.safe).toBe(false);
    expect(preview.body.data.blockingDebts.length).toBeGreaterThan(0);

    await api()
      .post(`/api/admin/groups/${groupId}/purge`)
      .set('Cookie', boss.cookie)
      .send({ from: TODAY, to: TODAY, confirmation: 'Flat 402' })
      .expect(400);

    // Nothing was destroyed by the refused call.
    const audits = await db.select().from(adminAudits);
    expect(audits.every((row) => row.action !== 'history.purged')).toBe(true);
  });

  it('refuses when the typed confirmation does not match the group name', async () => {
    const { boss, groupId } = await scenario();

    await api()
      .post(`/api/admin/groups/${groupId}/purge`)
      .set('Cookie', boss.cookie)
      .send({ from: TODAY, to: TODAY, confirmation: 'Flat 403' })
      .expect(400);
  });

  it('ignores a groupId smuggled in the body and uses the path', async () => {
    const { boss, groupId, second } = await scenario();

    const other = await api()
      .post('/api/groups')
      .set('Cookie', second.cookie)
      .send({ name: 'Other' })
      .expect(201);

    const preview = await api()
      .post(`/api/admin/groups/${groupId}/purge/preview`)
      .set('Cookie', boss.cookie)
      .send({ from: TODAY, to: TODAY, groupId: other.body.data.group.id })
      .expect(200);

    // Flat 402 has the expense; Other has none. Reading 1 proves the path won.
    expect(preview.body.data.expenseCount).toBe(1);
  });

  it('404s for a group that does not exist', async () => {
    const { boss } = await scenario();

    await api()
      .post('/api/admin/groups/00000000-0000-0000-0000-000000000000/purge/preview')
      .set('Cookie', boss.cookie)
      .send({ from: TODAY, to: TODAY })
      .expect(404);
  });
});
