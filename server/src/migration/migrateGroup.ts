import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Document, ObjectId } from 'mongodb';
import { db } from '../db/client.js';
import {
  activities,
  expenseParticipants,
  expenses,
  groupMembers,
  groups,
  notifications,
  settlements,
  users,
  type Expense,
} from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/passwordService.js';
import { generateInviteToken } from '../services/inviteCodeService.js';
import type { MongoSource } from './mongoSource.js';
import {
  classifyActivity,
  isBcryptHash,
  normaliseEmail,
  oid,
  reconcileShares,
  toCalendarDate,
  toDate,
  toNotificationType,
  toPaise,
  toPaymentMode,
  toSettlementStatus,
  toSplitType,
  IST_OFFSET_MINUTES,
} from './transform.js';

/**
 * Migrates one group and everything attached to it from the legacy MongoDB database.
 *
 * Properties this guarantees:
 *
 *  - The source is never written to (enforced by the read-only proxy in `mongoSource`).
 *  - It is IDEMPOTENT. Every migrated row carries `legacy_mongo_id`; re-running skips
 *    what already exists rather than duplicating it.
 *  - Money is converted to integer paise and every expense is made to reconcile exactly,
 *    with each repair reported.
 *  - Existing SplitWise accounts are matched by email and never overwritten.
 */

export type MigrationReport = {
  dryRun: boolean;
  group: { id: string; name: string; inviteCode: string } | null;
  users: { created: number; linked: number; skippedNoEmail: number };
  members: { created: number; existing: number };
  expenses: { created: number; existing: number; repaired: number; totalPaise: number };
  participants: { created: number };
  settlements: { created: number; existing: number };
  activities: { created: number; existing: number };
  notifications: { created: number; existing: number; danglingRefs: number };
  repairs: {
    expenseId: string;
    title: string;
    amountPaise: number;
    storedSumPaise: number;
    driftPaise: number;
  }[];
  warnings: string[];
};

export type MigrateOptions = {
  source: MongoSource;
  /** Legacy invite code identifying the group to copy. */
  inviteCode: string;
  /** When true, reads and validates everything but writes nothing. */
  dryRun?: boolean;
  /** Minutes east of UTC used to resolve stored instants to calendar dates. */
  timezoneOffsetMinutes?: number;
};

type LegacyUser = Document & {
  _id: ObjectId;
  fullName?: string;
  email?: string;
  password?: string;
  upiId?: string;
  qrCodeUrl?: string;
  createdAt?: Date;
};

export const migrateGroup = async (options: MigrateOptions): Promise<MigrationReport> => {
  const {
    source,
    inviteCode,
    dryRun = false,
    timezoneOffsetMinutes = IST_OFFSET_MINUTES,
  } = options;

  const report: MigrationReport = {
    dryRun,
    group: null,
    users: { created: 0, linked: 0, skippedNoEmail: 0 },
    members: { created: 0, existing: 0 },
    expenses: { created: 0, existing: 0, repaired: 0, totalPaise: 0 },
    participants: { created: 0 },
    settlements: { created: 0, existing: 0 },
    activities: { created: 0, existing: 0 },
    notifications: { created: 0, existing: 0, danglingRefs: 0 },
    repairs: [],
    warnings: [],
  };

  /* ---------------------------------------------------------------- */
  /* 1. Read everything from the source                               */
  /* ---------------------------------------------------------------- */

  const legacyGroup = await source
    .collection('groups')
    .findOne({ inviteCode: inviteCode.toUpperCase() });

  if (!legacyGroup) {
    throw new Error(`No group found in the source with invite code "${inviteCode}".`);
  }

  const groupObjectId = legacyGroup._id;
  const legacyGroupId = oid(groupObjectId);

  const [legacyMembers, legacyExpenses, legacySettlements, legacyActivities] = await Promise.all([
    source.collection('groupmembers').find({ groupId: groupObjectId }).toArray(),
    source.collection('expenses').find({ groupId: groupObjectId }).sort({ date: 1 }).toArray(),
    source
      .collection('settlements')
      .find({ groupId: groupObjectId })
      .sort({ createdAt: 1 })
      .toArray(),
    source
      .collection('activities')
      .find({ groupId: groupObjectId })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);

  const memberObjectIds = legacyMembers.map((member) => member.userId as ObjectId);

  const [legacyUsers, legacyNotifications] = await Promise.all([
    source
      .collection<LegacyUser>('users')
      .find({ _id: { $in: memberObjectIds } })
      .toArray(),
    source
      .collection('appnotifications')
      .find({ recipientUserId: { $in: memberObjectIds } })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);

  logger.info('migration.source_read', {
    group: legacyGroup.name,
    members: legacyMembers.length,
    expenses: legacyExpenses.length,
    settlements: legacySettlements.length,
    activities: legacyActivities.length,
    notifications: legacyNotifications.length,
  });

  /* ---------------------------------------------------------------- */
  /* 2. Users                                                          */
  /* ---------------------------------------------------------------- */

  /** legacy user id -> SplitWise user id */
  const userIdMap = new Map<string, string>();

  for (const legacyUser of legacyUsers) {
    const email = normaliseEmail(legacyUser.email);
    if (!email) {
      report.users.skippedNoEmail += 1;
      report.warnings.push(`User ${oid(legacyUser._id)} has no email and was skipped.`);
      continue;
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing[0]) {
      // Never touch an account that already exists here: its password, name and role
      // belong to the live system, not to the import.
      userIdMap.set(oid(legacyUser._id), existing[0].id);
      report.users.linked += 1;
      continue;
    }

    if (dryRun) {
      userIdMap.set(oid(legacyUser._id), `dry-run-user-${oid(legacyUser._id)}`);
      report.users.created += 1;
      continue;
    }

    /*
     * The legacy password hash is bcrypt and this system also uses bcrypt, so carrying
     * the hash across means every migrated member keeps the password they already know.
     * If a hash is ever missing or in an unexpected format we substitute an unusable
     * random one: the account exists but can only be entered via password reset.
     */
    let passwordHash = legacyUser.password;
    if (!isBcryptHash(passwordHash)) {
      passwordHash = await hashPassword(generateInviteToken());
      report.warnings.push(
        `${email}: legacy password hash was missing or unrecognised. ` +
          'The account was created with an unusable password; they must use "Forgot password".',
      );
    }

    const created = await db
      .insert(users)
      .values({
        fullName: String(legacyUser.fullName ?? email.split('@')[0]),
        email,
        passwordHash: passwordHash!,
        // These accounts were already in active use, so they are treated as verified.
        emailVerifiedAt: toDate(legacyUser.createdAt),
        upiId: legacyUser.upiId ? String(legacyUser.upiId) : null,
        qrCodeUrl: legacyUser.qrCodeUrl ? String(legacyUser.qrCodeUrl) : null,
        createdAt: toDate(legacyUser.createdAt),
      })
      .returning({ id: users.id });

    userIdMap.set(oid(legacyUser._id), created[0]!.id);
    report.users.created += 1;
  }

  const mapUser = (legacyId: unknown): string | null => userIdMap.get(oid(legacyId)) ?? null;

  /* ---------------------------------------------------------------- */
  /* 3. Group                                                          */
  /* ---------------------------------------------------------------- */

  const creatorId = mapUser(legacyGroup.createdBy);
  if (!creatorId) {
    throw new Error('The group creator could not be resolved to a user; aborting.');
  }

  const existingGroup = await db
    .select()
    .from(groups)
    .where(eq(groups.legacyMongoId, legacyGroupId))
    .limit(1);

  let groupId: string;

  if (existingGroup[0]) {
    groupId = existingGroup[0].id;
    report.group = {
      id: groupId,
      name: existingGroup[0].name,
      inviteCode: existingGroup[0].inviteCode,
    };
  } else if (dryRun) {
    groupId = 'dry-run-group';
    report.group = {
      id: groupId,
      name: String(legacyGroup.name),
      inviteCode: String(legacyGroup.inviteCode),
    };
  } else {
    /*
     * The legacy invite code is preserved so links and QR codes already shared with the
     * group keep working. It contains characters the new generator excludes (I, O, L);
     * that restriction governs generation only, not what the column may hold.
     */
    const inserted = await db
      .insert(groups)
      .values({
        name: String(legacyGroup.name),
        currency: 'INR',
        inviteCode: String(legacyGroup.inviteCode),
        inviteToken: String(legacyGroup.inviteToken ?? generateInviteToken()),
        payday:
          typeof legacyGroup.payday === 'number' && legacyGroup.payday >= 1 && legacyGroup.payday <= 31
            ? legacyGroup.payday
            : null,
        createdBy: creatorId,
        createdAt: toDate(legacyGroup.createdAt),
        legacyMongoId: legacyGroupId,
      })
      .returning();

    groupId = inserted[0]!.id;
    report.group = {
      id: groupId,
      name: inserted[0]!.name,
      inviteCode: inserted[0]!.inviteCode,
    };
  }

  /* ---------------------------------------------------------------- */
  /* 4. Memberships                                                    */
  /* ---------------------------------------------------------------- */

  for (const legacyMember of legacyMembers) {
    const userId = mapUser(legacyMember.userId);
    if (!userId) {
      report.warnings.push(`Membership ${oid(legacyMember._id)} has an unresolvable user.`);
      continue;
    }

    if (dryRun) {
      report.members.created += 1;
      continue;
    }

    const existing = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (existing[0]) {
      report.members.existing += 1;
      continue;
    }

    await db.insert(groupMembers).values({
      groupId,
      userId,
      role: legacyMember.role === 'creator' ? 'creator' : 'member',
      joinedAt: toDate(legacyMember.joinedAt, toDate(legacyGroup.createdAt)),
    });
    report.members.created += 1;
  }

  /* ---------------------------------------------------------------- */
  /* 5. Expenses and their frozen participant shares                   */
  /* ---------------------------------------------------------------- */

  /** legacy expense id -> SplitWise expense id */
  const expenseIdMap = new Map<string, string>();

  for (const legacyExpense of legacyExpenses) {
    const legacyExpenseId = oid(legacyExpense._id);
    const paidBy = mapUser(legacyExpense.paidBy);

    if (!paidBy) {
      report.warnings.push(
        `Expense "${legacyExpense.title}" (${legacyExpenseId}) has an unresolvable payer and was skipped.`,
      );
      continue;
    }

    const amountPaise = toPaise(legacyExpense.amount);
    if (amountPaise <= 0) {
      report.warnings.push(
        `Expense "${legacyExpense.title}" (${legacyExpenseId}) has a non-positive amount and was skipped.`,
      );
      continue;
    }

    // Shares are read from the stored split rows; they are the historical record.
    const rawShares: { userId: string; sharePaise: number }[] = [];
    for (const detail of (legacyExpense.splitDetails ?? []) as Document[]) {
      const participantId = mapUser(detail.user);
      if (!participantId) {
        report.warnings.push(
          `Expense ${legacyExpenseId} references a participant outside the group; that share was dropped.`,
        );
        continue;
      }
      rawShares.push({ userId: participantId, sharePaise: toPaise(detail.share) });
    }

    if (rawShares.length === 0) {
      report.warnings.push(
        `Expense "${legacyExpense.title}" (${legacyExpenseId}) has no usable participants and was skipped.`,
      );
      continue;
    }

    const storedSum = rawShares.reduce((total, row) => total + row.sharePaise, 0);
    const { participants, driftPaise, repaired } = reconcileShares(amountPaise, rawShares);

    if (repaired) {
      report.expenses.repaired += 1;
      report.repairs.push({
        expenseId: legacyExpenseId,
        title: String(legacyExpense.title),
        amountPaise,
        storedSumPaise: storedSum,
        driftPaise,
      });
    }

    report.expenses.totalPaise += amountPaise;

    if (dryRun) {
      // Placeholder mapping so notification link resolution below reports truthfully
      // rather than counting every reference as dangling.
      expenseIdMap.set(legacyExpenseId, `dry-run-expense-${legacyExpenseId}`);
      report.expenses.created += 1;
      report.participants.created += participants.length;
      continue;
    }

    const existing = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(eq(expenses.legacyMongoId, legacyExpenseId))
      .limit(1);

    if (existing[0]) {
      expenseIdMap.set(legacyExpenseId, existing[0].id);
      report.expenses.existing += 1;
      continue;
    }

    // One transaction per expense: the deferred reconciliation trigger fires at COMMIT,
    // so the expense and its shares must land together or not at all.
    const newId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(expenses)
        .values({
          groupId,
          title: String(legacyExpense.title ?? 'Untitled'),
          amountPaise,
          paidBy,
          splitType: toSplitType(legacyExpense.splitType),
          paymentMode: toPaymentMode(legacyExpense.paymentMode),
          category: null,
          expenseDate: toCalendarDate(legacyExpense.date, timezoneOffsetMinutes),
          notes: String(legacyExpense.notes ?? ''),
          receiptUrl: legacyExpense.screenshotUrl ? String(legacyExpense.screenshotUrl) : null,
          receiptStorageKey: legacyExpense.screenshotPublicId
            ? String(legacyExpense.screenshotPublicId)
            : null,
          // The legacy schema has no creator field; the payer recorded it.
          createdBy: paidBy,
          createdAt: toDate(legacyExpense.createdAt, toDate(legacyExpense.date)),
          updatedAt: toDate(legacyExpense.updatedAt, toDate(legacyExpense.date)),
          legacyMongoId: legacyExpenseId,
        } satisfies Partial<Expense> as never)
        .returning({ id: expenses.id });

      const expenseId = inserted[0]!.id;

      await tx.insert(expenseParticipants).values(
        participants.map((participant) => ({
          expenseId,
          userId: participant.userId,
          sharePaise: participant.sharePaise,
        })),
      );

      return expenseId;
    });

    expenseIdMap.set(legacyExpenseId, newId);
    report.expenses.created += 1;
    report.participants.created += participants.length;
  }

  /* ---------------------------------------------------------------- */
  /* 6. Settlements                                                    */
  /* ---------------------------------------------------------------- */

  /** legacy settlement id -> SplitWise settlement id */
  const settlementIdMap = new Map<string, string>();

  for (const legacySettlement of legacySettlements) {
    const legacySettlementId = oid(legacySettlement._id);
    const payerId = mapUser(legacySettlement.payer);
    const receiverId = mapUser(legacySettlement.receiver);

    if (!payerId || !receiverId || payerId === receiverId) {
      report.warnings.push(
        `Settlement ${legacySettlementId} has unresolvable or identical parties and was skipped.`,
      );
      continue;
    }

    const amountPaise = toPaise(legacySettlement.amount);
    if (amountPaise <= 0) {
      report.warnings.push(`Settlement ${legacySettlementId} has a non-positive amount; skipped.`);
      continue;
    }

    if (dryRun) {
      settlementIdMap.set(legacySettlementId, `dry-run-settlement-${legacySettlementId}`);
      report.settlements.created += 1;
      continue;
    }

    const existing = await db
      .select({ id: settlements.id })
      .from(settlements)
      .where(eq(settlements.legacyMongoId, legacySettlementId))
      .limit(1);

    if (existing[0]) {
      settlementIdMap.set(legacySettlementId, existing[0].id);
      report.settlements.existing += 1;
      continue;
    }

    const inserted = await db
      .insert(settlements)
      .values({
        groupId,
        payerId,
        receiverId,
        amountPaise,
        status: toSettlementStatus(legacySettlement.status),
        paymentMethod: toPaymentMode(legacySettlement.paymentMethod),
        proofUrl: legacySettlement.proofUrl ? String(legacySettlement.proofUrl) : null,
        proofStorageKey: legacySettlement.proofPublicId
          ? String(legacySettlement.proofPublicId)
          : null,
        rejectionReason: String(legacySettlement.rejectionReason ?? ''),
        note: String(legacySettlement.note ?? ''),
        paidAt: toDate(legacySettlement.paidAt, toDate(legacySettlement.createdAt)),
        verifiedAt: legacySettlement.verifiedAt ? toDate(legacySettlement.verifiedAt) : null,
        createdAt: toDate(legacySettlement.createdAt),
        updatedAt: toDate(legacySettlement.updatedAt, toDate(legacySettlement.createdAt)),
        legacyMongoId: legacySettlementId,
      })
      .returning({ id: settlements.id });

    settlementIdMap.set(legacySettlementId, inserted[0]!.id);
    report.settlements.created += 1;
  }

  /* ---------------------------------------------------------------- */
  /* 7. Activity audit trail                                           */
  /* ---------------------------------------------------------------- */

  for (const legacyActivity of legacyActivities) {
    const legacyActivityId = oid(legacyActivity._id);
    const actorUserId = mapUser(legacyActivity.user);

    if (!actorUserId) {
      report.warnings.push(`Activity ${legacyActivityId} has an unresolvable actor; skipped.`);
      continue;
    }

    if (dryRun) {
      report.activities.created += 1;
      continue;
    }

    const existing = await db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.legacyMongoId, legacyActivityId))
      .limit(1);

    if (existing[0]) {
      report.activities.existing += 1;
      continue;
    }

    await db.insert(activities).values({
      groupId,
      actorUserId,
      type: classifyActivity(legacyActivity.action),
      entityType: null,
      entityId: null,
      // The original sentence is kept verbatim so no audit detail is lost to the
      // coarser type classification.
      metadata: { legacyAction: String(legacyActivity.action ?? ''), migrated: true },
      createdAt: toDate(legacyActivity.createdAt),
      legacyMongoId: legacyActivityId,
    });

    report.activities.created += 1;
  }

  /* ---------------------------------------------------------------- */
  /* 8. Notifications                                                  */
  /* ---------------------------------------------------------------- */

  for (const legacyNotification of legacyNotifications) {
    const recipientUserId = mapUser(legacyNotification.recipientUserId);
    if (!recipientUserId) continue;

    const senderUserId = legacyNotification.senderUserId
      ? mapUser(legacyNotification.senderUserId)
      : null;

    // Resolve the referenced record; legacy notifications can outlive a deleted expense.
    const legacyEntityId = legacyNotification.entityId ? oid(legacyNotification.entityId) : null;
    let entityType: string | null = null;
    let entityId: string | null = null;

    if (legacyEntityId) {
      if (legacyNotification.entityType === 'expense' && expenseIdMap.has(legacyEntityId)) {
        entityType = 'expense';
        entityId = expenseIdMap.get(legacyEntityId)!;
      } else if (
        legacyNotification.entityType === 'settlement' &&
        settlementIdMap.has(legacyEntityId)
      ) {
        entityType = 'settlement';
        entityId = settlementIdMap.get(legacyEntityId)!;
      } else {
        // The notification is still meaningful history; only the link is dropped.
        report.notifications.danglingRefs += 1;
      }
    }

    if (dryRun) {
      report.notifications.created += 1;
      continue;
    }

    /*
     * Notifications carry no legacy id column, so duplicates are avoided by matching on
     * the natural key: recipient + created timestamp + title.
     */
    const createdAt = toDate(legacyNotification.createdAt);
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, recipientUserId),
          eq(notifications.createdAt, createdAt),
          eq(notifications.title, String(legacyNotification.title ?? '')),
        ),
      )
      .limit(1);

    if (existing[0]) {
      report.notifications.existing += 1;
      continue;
    }

    await db.insert(notifications).values({
      recipientUserId,
      senderUserId,
      groupId,
      type: toNotificationType(legacyNotification.type),
      title: String(legacyNotification.title ?? ''),
      message: String(legacyNotification.message ?? ''),
      entityType,
      entityId,
      readAt: legacyNotification.read ? createdAt : null,
      createdAt,
    });

    report.notifications.created += 1;
  }

  return report;
};

/* -------------------------------------------------------------------------- */
/* Verification                                                               */
/* -------------------------------------------------------------------------- */

export type BalanceCheck = {
  matches: boolean;
  rows: {
    debtor: string;
    creditor: string;
    legacyPaise: number;
    migratedPaise: number;
    deltaPaise: number;
  }[];
};

/**
 * Recomputes the debt graph from the SOURCE using the legacy algorithm and compares it
 * with what the new balance engine reports for the migrated group.
 *
 * This is the real proof that the migration preserved the money: it compares outcomes,
 * not row counts. A small expected difference exists wherever a drifted split was
 * repaired, so each pair reports its delta rather than only pass/fail.
 */
export const verifyBalances = async (
  source: MongoSource,
  inviteCode: string,
  groupId: string,
): Promise<BalanceCheck> => {
  const legacyGroup = await source
    .collection('groups')
    .findOne({ inviteCode: inviteCode.toUpperCase() });
  if (!legacyGroup) throw new Error('Source group vanished during verification.');

  const [legacyExpenses, legacySettlements, legacyMembers] = await Promise.all([
    source.collection('expenses').find({ groupId: legacyGroup._id }).toArray(),
    source
      .collection('settlements')
      .find({ groupId: legacyGroup._id, status: 'completed' })
      .toArray(),
    source.collection('groupmembers').find({ groupId: legacyGroup._id }).toArray(),
  ]);

  // Legacy algorithm: beneficiary owes payer their share; completed settlements subtract.
  const legacyGraph = new Map<string, number>();
  const key = (debtor: string, creditor: string) => `${debtor}->${creditor}`;

  for (const expense of legacyExpenses) {
    const payer = oid(expense.paidBy);
    for (const detail of (expense.splitDetails ?? []) as Document[]) {
      const beneficiary = oid(detail.user);
      if (beneficiary === payer) continue;
      const k = key(beneficiary, payer);
      legacyGraph.set(k, (legacyGraph.get(k) ?? 0) + toPaise(detail.share));
    }
  }

  for (const settlement of legacySettlements) {
    const k = key(oid(settlement.payer), oid(settlement.receiver));
    legacyGraph.set(k, (legacyGraph.get(k) ?? 0) - toPaise(settlement.amount));
  }

  // Map legacy ids to migrated ids via email, which is stable across both systems.
  const legacyUserIds = legacyMembers.map((m) => m.userId as ObjectId);
  const legacyUsers = await source
    .collection<LegacyUser>('users')
    .find({ _id: { $in: legacyUserIds } })
    .toArray();

  const emailByLegacyId = new Map(
    legacyUsers.map((u) => [oid(u._id), normaliseEmail(u.email)]),
  );

  const migratedUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      inArray(
        users.email,
        [...emailByLegacyId.values()].filter(Boolean),
      ),
    );
  const idByEmail = new Map(migratedUsers.map((u) => [u.email, u.id]));

  const { getPairwiseDebts } = await import('../services/balanceService.js');
  const migrated = await getPairwiseDebts(groupId);
  const migratedGraph = new Map(
    migrated.map((debt) => [key(debt.debtorId, debt.creditorId), debt.owedPaise]),
  );

  const rows: BalanceCheck['rows'] = [];
  let matches = true;

  for (const [k, rawLegacy] of legacyGraph) {
    const legacyPaise = Math.max(0, rawLegacy);
    if (legacyPaise === 0) continue;

    const [legacyDebtor, legacyCreditor] = k.split('->');
    const debtorEmail = emailByLegacyId.get(legacyDebtor!) ?? '';
    const creditorEmail = emailByLegacyId.get(legacyCreditor!) ?? '';
    const debtorId = idByEmail.get(debtorEmail);
    const creditorId = idByEmail.get(creditorEmail);

    const migratedPaise =
      debtorId && creditorId ? (migratedGraph.get(key(debtorId, creditorId)) ?? 0) : 0;

    const delta = migratedPaise - legacyPaise;
    if (delta !== 0) matches = false;

    rows.push({
      debtor: debtorEmail,
      creditor: creditorEmail,
      legacyPaise,
      migratedPaise,
      deltaPaise: delta,
    });
  }

  rows.sort((a, b) => Math.abs(b.deltaPaise) - Math.abs(a.deltaPaise));
  return { matches, rows };
};

export { sql };
