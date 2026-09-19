import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_KEYS,
  resolvePermissions,
} from '../src/auth/permissions.js';
import * as permissionService from '../src/services/permissionService.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const TODAY = new Date().toISOString().slice(0, 10);

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

/** Promotes an account to platform administrator and returns a fresh session. */
const admin = async (name: string) => {
  const person = await member(name);
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, person.userId));
  return person;
};

/* ========================================================================== */
/* Resolution                                                                 */
/* ========================================================================== */

describe('permission resolution', () => {
  it('gives an administrator everything', () => {
    const resolved = resolvePermissions('admin', []);
    expect(resolved.size).toBe(PERMISSION_KEYS.length);
    for (const key of PERMISSION_KEYS) expect(resolved.has(key)).toBe(true);
  });

  it('gives an ordinary user the registry defaults', () => {
    const resolved = resolvePermissions('user', []);
    expect([...resolved].sort()).toEqual([...DEFAULT_PERMISSIONS].sort());
  });

  it('allows granting something not held by default', () => {
    const resolved = resolvePermissions('user', [
      { permission: 'dashboard.spending', effect: 'allow' },
    ]);
    expect(resolved.has('dashboard.spending')).toBe(true);
  });

  it('allows revoking something held by default', () => {
    const resolved = resolvePermissions('user', [
      { permission: 'expenses.create', effect: 'deny' },
    ]);
    expect(resolved.has('expenses.create')).toBe(false);
  });

  it('ignores a stored key that is no longer in the registry', () => {
    const resolved = resolvePermissions('user', [
      { permission: 'legacy.something_removed', effect: 'allow' },
    ]);
    expect(resolved.has('legacy.something_removed')).toBe(false);
  });

  it('never lets an override widen an administrator, who already holds everything', () => {
    const resolved = resolvePermissions('admin', [
      { permission: 'expenses.create', effect: 'deny' },
    ]);
    // Role is the higher switch by design: demote them instead.
    expect(resolved.has('expenses.create')).toBe(true);
  });
});

/* ========================================================================== */
/* Enforcement through the API                                                */
/* ========================================================================== */

describe('permission enforcement', () => {
  it('reports the caller’s permissions on /me', async () => {
    const person = await member('alice');

    const res = await api().get('/api/auth/me').set('Cookie', person.cookie).expect(200);

    expect(res.body.data.permissions).toContain('expenses.create');
    expect(res.body.data.permissions).not.toContain('admin.access');
  });

  it('blocks an action once the permission is denied', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    const group = await api()
      .post('/api/groups')
      .set('Cookie', person.cookie)
      .send({ name: 'Flat 402' })
      .expect(201);
    const groupId = group.body.data.group.id as string;

    // Allowed to begin with.
    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', person.cookie)
      .send({ title: 'Dinner', amount: 100, expenseDate: TODAY })
      .expect(201);

    await api()
      .patch(`/api/admin/users/${person.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'expenses.create', effect: 'deny' }] })
      .expect(200);

    // Takes effect immediately, on the same session -- no re-login.
    const denied = await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', person.cookie)
      .send({ title: 'Later dinner', amount: 100, expenseDate: TODAY })
      .expect(403);

    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('restores the default when an override is cleared', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api()
      .patch(`/api/admin/users/${person.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'groups.create', effect: 'deny' }] })
      .expect(200);

    await api()
      .post('/api/groups')
      .set('Cookie', person.cookie)
      .send({ name: 'Blocked' })
      .expect(403);

    await api()
      .patch(`/api/admin/users/${person.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'groups.create', effect: null }] })
      .expect(200);

    await api()
      .post('/api/groups')
      .set('Cookie', person.cookie)
      .send({ name: 'Allowed again' })
      .expect(201);
  });

  it('keeps the admin console shut to an ordinary user', async () => {
    const person = await member('alice');
    await api().get('/api/admin/stats').set('Cookie', person.cookie).expect(403);
  });

  it('opens the console to a non-admin granted admin.access', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api()
      .patch(`/api/admin/users/${person.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'admin.access', effect: 'allow' }] })
      .expect(200);

    await api().get('/api/admin/stats').set('Cookie', person.cookie).expect(200);

    // But not the narrower gates that sit on top of it.
    await api()
      .post(`/api/admin/users/${boss.userId}/disable`)
      .set('Cookie', person.cookie)
      .send({})
      .expect(403);
  });

  it('refuses to store an unknown permission key', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api()
      .patch(`/api/admin/users/${person.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'not.a.real.permission', effect: 'allow' }] })
      .expect(400);
  });

  it('refuses to set an override against an administrator', async () => {
    const boss = await admin('boss');
    const other = await admin('other');

    await api()
      .patch(`/api/admin/users/${other.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'expenses.create', effect: 'deny' }] })
      .expect(400);
  });
});

/* ========================================================================== */
/* Account and group lifecycle                                                */
/* ========================================================================== */

describe('disabling accounts', () => {
  it('signs the person out and refuses a new sign-in', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api().get('/api/auth/me').set('Cookie', person.cookie).expect(200);

    await api()
      .post(`/api/admin/users/${person.userId}/disable`)
      .set('Cookie', boss.cookie)
      .send({ reason: 'Left the company' })
      .expect(200);

    // Existing session is dead.
    await api().get('/api/auth/me').set('Cookie', person.cookie).expect(401);

    // And so is signing in again -- with the reason surfaced.
    const login = await api()
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'CorrectHorse9' })
      .expect(403);

    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');
    expect(login.body.error.message).toContain('Left the company');
  });

  it('does not reveal a disabled account to someone with the wrong password', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api()
      .post(`/api/admin/users/${person.userId}/disable`)
      .set('Cookie', boss.cookie)
      .send({})
      .expect(200);

    // Wrong password must look exactly like any other failed sign-in.
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'WrongPassword1' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('lets the person back in once re-enabled', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api()
      .post(`/api/admin/users/${person.userId}/disable`)
      .set('Cookie', boss.cookie)
      .send({})
      .expect(200);

    await api()
      .post(`/api/admin/users/${person.userId}/enable`)
      .set('Cookie', boss.cookie)
      .expect(200);

    await api()
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'CorrectHorse9' })
      .expect(200);
  });

  it('stops an admin disabling themselves', async () => {
    const boss = await admin('boss');

    await api()
      .post(`/api/admin/users/${boss.userId}/disable`)
      .set('Cookie', boss.cookie)
      .send({})
      .expect(400);
  });
});

describe('disabling groups', () => {
  const groupWithMember = async () => {
    const owner = await member('owner');
    const boss = await admin('boss');

    const res = await api()
      .post('/api/groups')
      .set('Cookie', owner.cookie)
      .send({ name: 'Flat 402' })
      .expect(201);

    const group = res.body.data.group as { id: string; inviteCode: string };
    return { owner, boss, groupId: group.id, inviteCode: group.inviteCode };
  };

  it('makes the group read-only without hiding it', async () => {
    const { owner, boss, groupId } = await groupWithMember();

    await api()
      .post(`/api/admin/groups/${groupId}/disable`)
      .set('Cookie', boss.cookie)
      .expect(200);

    // Still readable: their history is still theirs.
    await api().get(`/api/groups/${groupId}`).set('Cookie', owner.cookie).expect(200);

    const blocked = await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Dinner', amount: 100, expenseDate: TODAY })
      .expect(403);

    expect(blocked.body.error.code).toBe('GROUP_DISABLED');
  });

  it('accepts writes again once re-enabled', async () => {
    const { owner, boss, groupId } = await groupWithMember();

    await api()
      .post(`/api/admin/groups/${groupId}/disable`)
      .set('Cookie', boss.cookie)
      .expect(200);
    await api()
      .post(`/api/admin/groups/${groupId}/enable`)
      .set('Cookie', boss.cookie)
      .expect(200);

    await api()
      .post(`/api/groups/${groupId}/expenses`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Dinner', amount: 100, expenseDate: TODAY })
      .expect(201);
  });
});

describe('admin password reset', () => {
  it('sets a new password and ends every existing session', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api()
      .post(`/api/admin/users/${person.userId}/password`)
      .set('Cookie', boss.cookie)
      .send({ password: 'BrandNewPass8' })
      .expect(200);

    // Their old session no longer works.
    await api().get('/api/auth/me').set('Cookie', person.cookie).expect(401);

    // The old password no longer works.
    await api()
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'CorrectHorse9' })
      .expect(401);

    // The new one does.
    await api()
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'BrandNewPass8' })
      .expect(200);
  });

  it('refuses a weak password', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await api()
      .post(`/api/admin/users/${person.userId}/password`)
      .set('Cookie', boss.cookie)
      .send({ password: 'short' })
      .expect(400);
  });

  it('never returns the password it was given', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    const res = await api()
      .post(`/api/admin/users/${person.userId}/password`)
      .set('Cookie', boss.cookie)
      .send({ password: 'BrandNewPass8' })
      .expect(200);

    expect(JSON.stringify(res.body)).not.toContain('BrandNewPass8');
  });
});

/* ========================================================================== */
/* Spending dashboard scope                                                   */
/* ========================================================================== */

describe('spending dashboard', () => {
  const setup = async () => {
    const owner = await member('owner');
    const other = await member('other');
    const viewer = await member('viewer');
    const boss = await admin('boss');

    const makeGroup = async (name: string) => {
      const res = await api()
        .post('/api/groups')
        .set('Cookie', owner.cookie)
        .send({ name })
        .expect(201);
      const group = res.body.data.group as { id: string; inviteCode: string };
      await joinGroupByInvite(group.inviteCode, other.userId);
      await api()
        .post(`/api/groups/${group.id}/expenses`)
        .set('Cookie', owner.cookie)
        .send({ title: 'Dinner', amount: 1000, expenseDate: TODAY })
        .expect(201);
      return group.id;
    };

    const groupA = await makeGroup('Flat 402');
    const groupB = await makeGroup('Goa Trip');

    return { owner, other, viewer, boss, groupA, groupB };
  };

  it('is closed without the permission', async () => {
    const { viewer } = await setup();
    await api().get('/api/insights/spending').set('Cookie', viewer.cookie).expect(403);
  });

  it('returns nothing when granted the permission but no scope', async () => {
    const { viewer, boss } = await setup();

    await api()
      .patch(`/api/admin/users/${viewer.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'dashboard.spending', effect: 'allow' }] })
      .expect(200);

    const res = await api()
      .get('/api/insights/spending')
      .set('Cookie', viewer.cookie)
      .expect(200);

    // Fails closed: a missing scope shows nothing, not everything.
    expect(res.body.data.scope.kind).toBe('none');
    expect(res.body.data.people).toEqual([]);
  });

  it('shows only the groups the admin selected', async () => {
    const { viewer, boss, groupA } = await setup();

    await api()
      .patch(`/api/admin/users/${viewer.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'dashboard.spending', effect: 'allow' }] })
      .expect(200);

    await api()
      .put(`/api/admin/users/${viewer.userId}/dashboard-scope`)
      .set('Cookie', boss.cookie)
      .send({ scope: 'selected_groups', groupIds: [groupA] })
      .expect(200);

    const res = await api()
      .get('/api/insights/spending')
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(res.body.data.groups).toHaveLength(1);
    expect(res.body.data.groups[0].id).toBe(groupA);
    // One group's ₹1000, not both.
    expect(res.body.data.totals.spentPaise).toBe(100_000);
  });

  it('refuses to widen the scope through a groupId parameter', async () => {
    const { viewer, boss, groupA, groupB } = await setup();

    await api()
      .patch(`/api/admin/users/${viewer.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'dashboard.spending', effect: 'allow' }] })
      .expect(200);

    await api()
      .put(`/api/admin/users/${viewer.userId}/dashboard-scope`)
      .set('Cookie', boss.cookie)
      .send({ scope: 'selected_groups', groupIds: [groupA] })
      .expect(200);

    const res = await api()
      .get(`/api/insights/spending?groupId=${groupB}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(res.body.data.scope.kind).toBe('none');
    expect(res.body.data.people).toEqual([]);
  });

  it('covers everything under an all-groups grant', async () => {
    const { viewer, boss } = await setup();

    await api()
      .patch(`/api/admin/users/${viewer.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'dashboard.spending', effect: 'allow' }] })
      .expect(200);

    await api()
      .put(`/api/admin/users/${viewer.userId}/dashboard-scope`)
      .set('Cookie', boss.cookie)
      .send({ scope: 'all_groups', groupIds: [] })
      .expect(200);

    const res = await api()
      .get('/api/insights/spending')
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(res.body.data.totals.spentPaise).toBe(200_000);
    expect(res.body.data.people.length).toBeGreaterThanOrEqual(2);
  });

  it('closes again when the scope is cleared', async () => {
    const { viewer, boss, groupA } = await setup();

    await api()
      .patch(`/api/admin/users/${viewer.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'dashboard.spending', effect: 'allow' }] })
      .expect(200);
    await api()
      .put(`/api/admin/users/${viewer.userId}/dashboard-scope`)
      .set('Cookie', boss.cookie)
      .send({ scope: 'selected_groups', groupIds: [groupA] })
      .expect(200);
    await api()
      .delete(`/api/admin/users/${viewer.userId}/dashboard-scope`)
      .set('Cookie', boss.cookie)
      .expect(200);

    const res = await api()
      .get('/api/insights/spending')
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(res.body.data.scope.kind).toBe('none');
  });

  it('reports share and out-of-pocket separately', async () => {
    const { owner, other, viewer, boss } = await setup();

    await api()
      .patch(`/api/admin/users/${viewer.userId}/permissions`)
      .set('Cookie', boss.cookie)
      .send({ changes: [{ permission: 'dashboard.spending', effect: 'allow' }] })
      .expect(200);
    await api()
      .put(`/api/admin/users/${viewer.userId}/dashboard-scope`)
      .set('Cookie', boss.cookie)
      .send({ scope: 'all_groups', groupIds: [] })
      .expect(200);

    const res = await api()
      .get('/api/insights/spending')
      .set('Cookie', viewer.cookie)
      .expect(200);

    const ownerRow = res.body.data.people.find(
      (person: { userId: string }) => person.userId === owner.userId,
    );
    const otherRow = res.body.data.people.find(
      (person: { userId: string }) => person.userId === other.userId,
    );

    // The owner paid both ₹1000 bills but only owns half of each.
    expect(ownerRow.paidPaise).toBe(200_000);
    expect(ownerRow.spentPaise).toBe(100_000);
    expect(otherRow.paidPaise).toBe(0);
    expect(otherRow.spentPaise).toBe(100_000);
  });
});

/* ========================================================================== */
/* Service-level helpers                                                      */
/* ========================================================================== */

describe('permissionService', () => {
  it('counts overrides per user for the admin list', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await permissionService.setPermission({
      userId: person.userId,
      permission: 'dashboard.spending',
      effect: 'allow',
      actorUserId: boss.userId,
    });

    const counts = await permissionService.countOverridesFor([person.userId, boss.userId]);
    expect(counts.get(person.userId)).toBe(1);
    expect(counts.get(boss.userId)).toBeUndefined();
  });

  it('updates rather than duplicating when the same permission is set twice', async () => {
    const person = await member('alice');
    const boss = await admin('boss');

    await permissionService.setPermission({
      userId: person.userId,
      permission: 'dashboard.spending',
      effect: 'allow',
      actorUserId: boss.userId,
    });
    await permissionService.setPermission({
      userId: person.userId,
      permission: 'dashboard.spending',
      effect: 'deny',
      actorUserId: boss.userId,
    });

    const overrides = await permissionService.listOverrides(person.userId);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]!.effect).toBe('deny');
  });
});
