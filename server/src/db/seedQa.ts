/**
 * QA seed.
 *
 * Creates a predictable group with several members, expenses and settlements so the UI
 * can be exercised at every breakpoint against realistic data. Development only --
 * refuses to run against a production database.
 *
 *   npm run db:seed:qa
 */
import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { users } from './schema.js';
import { env } from '../config/env.js';
import { hashPassword } from '../services/passwordService.js';
import { createGroup, joinGroupByInvite } from '../services/groupService.js';
import { createExpense } from '../services/expenseService.js';
import { approveSettlement, createSettlement } from '../services/settlementService.js';
import { rupeesToPaise } from '../utils/money.js';

/**
 * QA fixtures with a well-known password, so the automated browser checks can sign in.
 *
 * Refuses to run against production: these are shared, published credentials, and
 * seeding them onto a live deployment would create four accounts anyone could sign
 * into.
 */
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    '[seed:qa] Refusing to run with NODE_ENV=production.\n' +
      '          These fixtures use a publicly known password and are for local QA only.',
  );
}

const PASSWORD = 'QaPassword1';

const PEOPLE = [
  { fullName: 'Aarti Menon', email: 'aarti@qa.local' },
  { fullName: 'Rahul Verma', email: 'rahul@qa.local' },
  { fullName: 'Sneha Iyer', email: 'sneha@qa.local' },
  { fullName: 'Vikram Rao', email: 'vikram@qa.local' },
];

const dayOffset = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const ensureUser = async (person: (typeof PEOPLE)[number], passwordHash: string) => {
  const existing = await db.select().from(users).where(eq(users.email, person.email)).limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(users)
    .values({
      fullName: person.fullName,
      email: person.email,
      passwordHash,
      emailVerifiedAt: new Date(),
      upiId: `${person.email.split('@')[0]}@okbank`,
    })
    .returning();

  return inserted[0]!;
};

const run = async (): Promise<void> => {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed QA data in production');
  }

  const passwordHash = await hashPassword(PASSWORD);
  const people = [];
  for (const person of PEOPLE) people.push(await ensureUser(person, passwordHash));

  const [aarti, rahul, sneha, vikram] = people as [
    (typeof people)[0],
    (typeof people)[0],
    (typeof people)[0],
    (typeof people)[0],
  ];

  const { group } = await createGroup({ name: 'Apartment 402', userId: aarti.id });
  await joinGroupByInvite(group.inviteCode, rahul.id);
  await joinGroupByInvite(group.inviteCode, sneha.id);
  await joinGroupByInvite(group.inviteCode, vikram.id);

  const spend = (
    paidBy: string,
    title: string,
    rupees: number,
    daysAgo: number,
    options: { participantIds?: string[]; mode?: 'cash' | 'upi'; category?: string } = {},
  ) =>
    createExpense({
      groupId: group.id,
      actorUserId: paidBy,
      title,
      amountPaise: rupeesToPaise(rupees)!,
      paidBy,
      splitType: options.participantIds ? 'specific' : 'everyone',
      participantIds: options.participantIds,
      paymentMode: options.mode ?? 'cash',
      category: (options.category ?? null) as never,
      expenseDate: dayOffset(-daysAgo),
    });

  // A spread of amounts, dates and split shapes, including a 3-way remainder.
  await spend(aarti.id, 'Monthly rent', 48000, 26, { category: 'rent', mode: 'upi' });
  await spend(rahul.id, 'Electricity bill', 3240.5, 24, { category: 'utilities', mode: 'upi' });
  await spend(sneha.id, 'Big Bazaar groceries', 4870.25, 21, { category: 'groceries' });
  await spend(vikram.id, 'Internet — Airtel', 1599, 19, { category: 'utilities', mode: 'upi' });
  await spend(aarti.id, 'Dinner at Truffles', 1000, 16, {
    category: 'food_dining',
    participantIds: [aarti.id, rahul.id, sneha.id],
  });
  await spend(rahul.id, 'Auto to airport', 640, 13, { category: 'travel' });
  await spend(sneha.id, 'Cleaning supplies', 890.75, 11, { category: 'household' });
  await spend(aarti.id, 'Weekend groceries', 2450, 8, { category: 'groceries', mode: 'upi' });
  await spend(vikram.id, 'Movie night', 1200, 6, {
    category: 'entertainment',
    participantIds: [vikram.id, aarti.id],
  });
  await spend(rahul.id, 'Pharmacy run', 430.5, 4, { category: 'medical' });
  await spend(aarti.id, 'Water can refills', 360, 2, { category: 'household' });
  await spend(sneha.id, 'Sunday brunch', 2870, 1, { category: 'food_dining', mode: 'upi' });

  // One completed settlement, so a balance has visibly moved.
  const completed = await createSettlement({
    groupId: group.id,
    payerId: rahul.id,
    receiverId: aarti.id,
    amountPaise: rupeesToPaise(5000)!,
    paymentMethod: 'upi',
    actionType: 'payment',
    proofUrl: 'https://example.test/proof.png',
  });
  await approveSettlement(completed.id, group.id, aarti.id);

  // One awaiting Aarti's approval, so the attention centre has something in it.
  await createSettlement({
    groupId: group.id,
    payerId: sneha.id,
    receiverId: aarti.id,
    amountPaise: rupeesToPaise(2500)!,
    paymentMethod: 'cash',
    actionType: 'payment',
  });

  console.log('[qa] seeded group:', group.name, 'invite:', group.inviteCode);
  console.log('[qa] sign in as: aarti@qa.local /', PASSWORD);
  await pool.end();
};

run().catch((error: unknown) => {
  console.error('[qa] seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
