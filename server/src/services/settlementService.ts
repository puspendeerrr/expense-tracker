import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  activities,
  groupMembers,
  settlements,
  users,
  type Settlement,
} from '../db/schema.js';
import { ERROR_CODES, badRequest, forbidden, notFound } from '../utils/errors.js';
import { getOutstandingBetween } from './balanceService.js';
import { formatPaise } from '../utils/money.js';

/**
 * Settlement engine.
 *
 * State machine (only `completed` ever moves a balance):
 *
 *   paid_pending_approval ──approve──▶ completed
 *            │                          (terminal)
 *            ├──reject───▶ rejected ──reupload──▶ paid_pending_approval
 *            └──cancel───▶ cancelled (terminal)
 *
 *   will_pay_soon ──cancel──▶ cancelled      (a promise, never a payment)
 */

const assertGroupMember = async (groupId: string, userId: string): Promise<void> => {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (!rows[0]) {
    throw badRequest(
      ERROR_CODES.NOT_GROUP_MEMBER,
      'That person is not a member of this group.',
    );
  }
};

export type CreateSettlementInput = {
  groupId: string;
  payerId: string;
  receiverId: string;
  amountPaise: number;
  paymentMethod: 'cash' | 'upi';
  /** `will_pay_soon` records an intention; it does not record a payment. */
  actionType: 'payment' | 'will_pay_soon';
  proofUrl?: string | null;
  proofStorageKey?: string | null;
  note?: string;
};

/**
 * Records a settlement.
 *
 * Two guards the reference implementation lacked:
 *
 * 1. The receiver must be a member of the same group. The reference only checked the
 *    user existed, which permitted cross-group settlements.
 * 2. The amount may not exceed the live outstanding debt. The reference clamped the
 *    resulting balance at zero, so paying ₹500 against a ₹300 debt silently destroyed
 *    ₹200. Rejecting up front is the only option that cannot lose money.
 */
export const createSettlement = async (
  input: CreateSettlementInput,
): Promise<Settlement> => {
  if (input.payerId === input.receiverId) {
    throw badRequest(ERROR_CODES.SELF_SETTLEMENT, 'You cannot settle up with yourself.');
  }

  await assertGroupMember(input.groupId, input.receiverId);

  if (input.actionType === 'payment' && input.paymentMethod === 'upi' && !input.proofUrl?.trim()) {
    throw badRequest(
      ERROR_CODES.SETTLEMENT_PROOF_REQUIRED,
      'Attach a payment screenshot for UPI settlements.',
    );
  }

  const outstandingPaise = await getOutstandingBetween(
    input.groupId,
    input.payerId,
    input.receiverId,
  );

  if (outstandingPaise === 0) {
    throw badRequest(
      ERROR_CODES.SETTLEMENT_EXCEEDS_DEBT,
      'You do not currently owe this person anything.',
      { outstandingPaise: 0 },
    );
  }

  if (input.amountPaise > outstandingPaise) {
    throw badRequest(
      ERROR_CODES.SETTLEMENT_EXCEEDS_DEBT,
      `You only owe ${formatPaise(outstandingPaise)} to this person.`,
      { outstandingPaise, attemptedPaise: input.amountPaise },
    );
  }

  const status = input.actionType === 'will_pay_soon' ? 'will_pay_soon' : 'paid_pending_approval';

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(settlements)
      .values({
        groupId: input.groupId,
        payerId: input.payerId,
        receiverId: input.receiverId,
        amountPaise: input.amountPaise,
        status,
        paymentMethod: input.paymentMethod,
        proofUrl: input.proofUrl ?? null,
        proofStorageKey: input.proofStorageKey ?? null,
        note: input.note ?? '',
      })
      .returning();

    const settlement = inserted[0]!;

    await tx.insert(activities).values({
      groupId: input.groupId,
      actorUserId: input.payerId,
      type: 'settlement_created',
      entityType: 'settlement',
      entityId: settlement.id,
      metadata: {
        amountPaise: settlement.amountPaise,
        receiverId: input.receiverId,
        status,
      },
    });

    return settlement;
  });
};

const loadSettlement = async (settlementId: string, groupId: string): Promise<Settlement> => {
  const rows = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId)))
    .limit(1);

  const settlement = rows[0];
  if (!settlement) throw notFound('Settlement not found.');
  return settlement;
};

/**
 * Receiver confirms the money arrived. This is the single transition that moves a
 * balance, so it is a conditional UPDATE: two concurrent approvals cannot both win,
 * and an already-terminal settlement cannot be re-approved.
 */
export const approveSettlement = async (
  settlementId: string,
  groupId: string,
  actorUserId: string,
): Promise<Settlement> => {
  const settlement = await loadSettlement(settlementId, groupId);

  if (settlement.receiverId !== actorUserId) {
    throw forbidden(
      ERROR_CODES.FORBIDDEN,
      'Only the person receiving the payment can approve it.',
    );
  }

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(settlements)
      .set({ status: 'completed', verifiedAt: new Date(), rejectionReason: '', updatedAt: new Date() })
      .where(
        and(
          eq(settlements.id, settlementId),
          eq(settlements.status, 'paid_pending_approval'),
        ),
      )
      .returning();

    if (!updated[0]) {
      throw badRequest(
        ERROR_CODES.SETTLEMENT_INVALID_STATE,
        'This settlement is no longer awaiting your approval.',
      );
    }

    await tx.insert(activities).values({
      groupId,
      actorUserId,
      type: 'settlement_approved',
      entityType: 'settlement',
      entityId: settlementId,
      metadata: { amountPaise: updated[0].amountPaise, payerId: settlement.payerId },
    });

    return updated[0];
  });
};

export const rejectSettlement = async (
  settlementId: string,
  groupId: string,
  actorUserId: string,
  reason: string,
): Promise<Settlement> => {
  const settlement = await loadSettlement(settlementId, groupId);

  if (settlement.receiverId !== actorUserId) {
    throw forbidden(
      ERROR_CODES.FORBIDDEN,
      'Only the person receiving the payment can reject it.',
    );
  }

  const cleanReason = reason.trim() || 'Payment was not verified by the receiver.';

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(settlements)
      .set({ status: 'rejected', rejectionReason: cleanReason, updatedAt: new Date() })
      .where(
        and(eq(settlements.id, settlementId), eq(settlements.status, 'paid_pending_approval')),
      )
      .returning();

    if (!updated[0]) {
      throw badRequest(
        ERROR_CODES.SETTLEMENT_INVALID_STATE,
        'This settlement is no longer awaiting your approval.',
      );
    }

    await tx.insert(activities).values({
      groupId,
      actorUserId,
      type: 'settlement_rejected',
      entityType: 'settlement',
      entityId: settlementId,
      metadata: { amountPaise: updated[0].amountPaise, reason: cleanReason },
    });

    return updated[0];
  });
};

/** Payer attaches fresh proof, moving a rejected settlement back into review. */
export const reuploadProof = async (
  settlementId: string,
  groupId: string,
  actorUserId: string,
  proofUrl: string,
  proofStorageKey: string | null,
): Promise<{ settlement: Settlement; previousStorageKey: string | null }> => {
  const settlement = await loadSettlement(settlementId, groupId);

  if (settlement.payerId !== actorUserId) {
    throw forbidden(ERROR_CODES.FORBIDDEN, 'Only the payer can attach new proof.');
  }

  const updated = await db
    .update(settlements)
    .set({
      proofUrl,
      proofStorageKey,
      status: 'paid_pending_approval',
      rejectionReason: '',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(settlements.id, settlementId),
        inArray(settlements.status, ['rejected', 'paid_pending_approval']),
      ),
    )
    .returning();

  if (!updated[0]) {
    throw badRequest(
      ERROR_CODES.SETTLEMENT_INVALID_STATE,
      'This settlement can no longer be updated.',
    );
  }

  return { settlement: updated[0], previousStorageKey: settlement.proofStorageKey };
};

/** Either party may withdraw a settlement that has not completed. */
export const cancelSettlement = async (
  settlementId: string,
  groupId: string,
  actorUserId: string,
  /**
   * Lets an administrator cancel a settlement they are not party to.
   *
   * Authorisation only. The status transition, its guards and the balance consequences
   * are unchanged -- cancelling still simply stops the row counting toward a balance,
   * which the balance engine derives rather than stores.
   */
  options: { bypassParticipantCheck?: boolean } = {},
): Promise<Settlement> => {
  const settlement = await loadSettlement(settlementId, groupId);

  if (
    !options.bypassParticipantCheck &&
    settlement.payerId !== actorUserId &&
    settlement.receiverId !== actorUserId
  ) {
    throw forbidden(ERROR_CODES.FORBIDDEN, 'You are not part of this settlement.');
  }

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(settlements)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(settlements.id, settlementId),
          inArray(settlements.status, ['paid_pending_approval', 'will_pay_soon', 'rejected']),
        ),
      )
      .returning();

    if (!updated[0]) {
      throw badRequest(
        ERROR_CODES.SETTLEMENT_INVALID_STATE,
        'A completed settlement cannot be cancelled.',
      );
    }

    await tx.insert(activities).values({
      groupId,
      actorUserId,
      type: 'settlement_cancelled',
      entityType: 'settlement',
      entityId: settlementId,
      metadata: { amountPaise: updated[0].amountPaise },
    });

    return updated[0];
  });
};

/** Paginated settlement history for a group, optionally filtered by status. */
export const listSettlements = async (options: {
  groupId: string;
  status?: Settlement['status'] | 'all';
  limit: number;
  offset: number;
}) => {
  const conditions = [eq(settlements.groupId, options.groupId)];
  if (options.status && options.status !== 'all') {
    conditions.push(eq(settlements.status, options.status));
  }

  const rows = await db
    .select({ settlement: settlements })
    .from(settlements)
    .where(and(...conditions))
    .orderBy(desc(settlements.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(settlements)
    .where(and(...conditions));

  return { rows, total: totalRows[0]?.count ?? 0 };
};

/**
 * Settlements needing the user's attention, for the dashboard's action centre.
 * Bounded at 50 rows so this can never become an unbounded fetch.
 */
export const getAttentionItems = async (groupId: string, userId: string) => {
  const rows = await db
    .select({ settlement: settlements, payer: users })
    .from(settlements)
    .innerJoin(users, eq(users.id, settlements.payerId))
    .where(
      and(
        eq(settlements.groupId, groupId),
        inArray(settlements.status, ['paid_pending_approval', 'rejected', 'will_pay_soon']),
        or(eq(settlements.payerId, userId), eq(settlements.receiverId, userId)),
      ),
    )
    .orderBy(desc(settlements.createdAt))
    .limit(50);

  const items = rows.map((row) => row.settlement);

  return {
    awaitingMyApproval: items.filter(
      (s) => s.status === 'paid_pending_approval' && s.receiverId === userId,
    ),
    awaitingTheirApproval: items.filter(
      (s) => s.status === 'paid_pending_approval' && s.payerId === userId,
    ),
    rejectedNeedingAction: items.filter((s) => s.status === 'rejected' && s.payerId === userId),
    myPromises: items.filter((s) => s.status === 'will_pay_soon' && s.payerId === userId),
    promisesToMe: items.filter((s) => s.status === 'will_pay_soon' && s.receiverId === userId),
  };
};
