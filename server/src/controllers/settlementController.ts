import type { Request, Response } from 'express';
import { sendOk } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { formatPaise, paiseToRupees } from '../utils/money.js';
import { validated } from '../middleware/validate.js';
import {
  createSettlementSchema,
  listSettlementsQuerySchema,
  rejectSettlementSchema,
  reuploadProofSchema,
} from '../validation/settlementSchemas.js';
import * as settlementService from '../services/settlementService.js';
import { publishToGroup } from '../realtime/socketServer.js';
import { REALTIME_EVENTS } from '../realtime/events.js';
import * as notificationService from '../services/notificationService.js';
import * as pushService from '../services/pushService.js';
import { getOutstandingBetween, getUserBalanceSummary } from '../services/balanceService.js';
import * as settlementPlanService from '../services/settlementPlanService.js';
import * as groupService from '../services/groupService.js';
import type { Settlement } from '../db/schema.js';

const publicSettlement = (settlement: Settlement, viewerId?: string) => ({
  id: settlement.id,
  groupId: settlement.groupId,
  payerId: settlement.payerId,
  receiverId: settlement.receiverId,
  amountPaise: settlement.amountPaise,
  amount: paiseToRupees(settlement.amountPaise),
  status: settlement.status,
  paymentMethod: settlement.paymentMethod,
  proofUrl: settlement.proofUrl,
  hasProof: Boolean(settlement.proofUrl),
  rejectionReason: settlement.rejectionReason,
  note: settlement.note,
  paidAt: settlement.paidAt.toISOString(),
  verifiedAt: settlement.verifiedAt?.toISOString() ?? null,
  createdAt: settlement.createdAt.toISOString(),
  ...(viewerId
    ? { direction: settlement.payerId === viewerId ? 'outgoing' : 'incoming' }
    : {}),
});

export const createSettlement = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, createSettlementSchema);

  const settlement = await settlementService.createSettlement({
    groupId: req.group!.id,
    // The payer is always the authenticated caller. Accepting a client-supplied payer
    // would let anyone record a payment on someone else's behalf.
    payerId: req.user!.id,
    receiverId: input.receiverId,
    amountPaise: input.amount,
    paymentMethod: input.paymentMethod,
    actionType: input.actionType,
    proofUrl: input.proofUrl ?? null,
    proofStorageKey: input.proofStorageKey ?? null,
    note: input.note ?? '',
  });

  logger.info('settlement.created', {
    settlementId: settlement.id,
    groupId: req.group!.id,
    payerId: req.user!.id,
    status: settlement.status,
  });

  void notificationService.createNotification({
    recipientUserId: input.receiverId,
    senderUserId: req.user!.id,
    groupId: req.group!.id,
    type: 'settlement_requested',
    title:
      input.actionType === 'will_pay_soon' ? 'Payment promised' : 'Payment awaiting your approval',
    message:
      input.actionType === 'will_pay_soon'
        ? `${req.user!.fullName} will pay you ${formatPaise(settlement.amountPaise)} soon.`
        : `${req.user!.fullName} says they paid you ${formatPaise(settlement.amountPaise)}. Please confirm.`,
    entityType: 'settlement',
    entityId: settlement.id,
  });

  void pushService.sendToUser(input.receiverId, {
    title: input.actionType === 'will_pay_soon' ? 'Payment promised' : 'Confirm a payment',
    body: `${req.user!.fullName} — ${formatPaise(settlement.amountPaise)}`,
    url: '/app/settlements',
    tag: `settlement-${settlement.id}`,
  });

  publishToGroup({
    event: REALTIME_EVENTS.SETTLEMENT_CREATED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: settlement.id,
    message: `${req.user!.fullName} recorded a payment of ${formatPaise(settlement.amountPaise)}`,
  });

  sendOk(res, { settlement: publicSettlement(settlement, req.user!.id) }, 201);
};

export const approveSettlement = async (req: Request, res: Response): Promise<void> => {
  const settlement = await settlementService.approveSettlement(
    String(req.params.settlementId),
    req.group!.id,
    req.user!.id,
  );

  logger.info('settlement.approved', {
    settlementId: settlement.id,
    groupId: req.group!.id,
    approverId: req.user!.id,
  });

  void notificationService.createNotification({
    recipientUserId: settlement.payerId,
    senderUserId: req.user!.id,
    groupId: req.group!.id,
    type: 'settlement_approved',
    title: 'Payment confirmed',
    message: `${req.user!.fullName} confirmed your payment of ${formatPaise(settlement.amountPaise)}.`,
    entityType: 'settlement',
    entityId: settlement.id,
  });

  publishToGroup({
    event: REALTIME_EVENTS.SETTLEMENT_APPROVED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: settlement.id,
    message: `${req.user!.fullName} confirmed a payment of ${formatPaise(settlement.amountPaise)}`,
  });

  sendOk(res, { settlement: publicSettlement(settlement, req.user!.id) });
};

export const rejectSettlement = async (req: Request, res: Response): Promise<void> => {
  const { rejectionReason } = validated(req, rejectSettlementSchema);

  const settlement = await settlementService.rejectSettlement(
    String(req.params.settlementId),
    req.group!.id,
    req.user!.id,
    rejectionReason ?? '',
  );

  void notificationService.createNotification({
    recipientUserId: settlement.payerId,
    senderUserId: req.user!.id,
    groupId: req.group!.id,
    type: 'settlement_rejected',
    title: 'Payment not confirmed',
    message: `${req.user!.fullName} could not confirm your ${formatPaise(settlement.amountPaise)} payment. Reason: ${settlement.rejectionReason}`,
    entityType: 'settlement',
    entityId: settlement.id,
  });

  publishToGroup({
    event: REALTIME_EVENTS.SETTLEMENT_REJECTED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: settlement.id,
    message: `${req.user!.fullName} rejected a payment of ${formatPaise(settlement.amountPaise)}`,
  });

  sendOk(res, { settlement: publicSettlement(settlement, req.user!.id) });
};

export const reuploadProof = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, reuploadProofSchema);

  const result = await settlementService.reuploadProof(
    String(req.params.settlementId),
    req.group!.id,
    req.user!.id,
    input.proofUrl,
    input.proofStorageKey ?? null,
  );

  publishToGroup({
    event: REALTIME_EVENTS.SETTLEMENT_PROOF_UPDATED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: result.settlement.id,
    message: `${req.user!.fullName} attached new payment proof`,
  });

  sendOk(res, { settlement: publicSettlement(result.settlement, req.user!.id) });
};

export const cancelSettlement = async (req: Request, res: Response): Promise<void> => {
  const settlement = await settlementService.cancelSettlement(
    String(req.params.settlementId),
    req.group!.id,
    req.user!.id,
  );

  publishToGroup({
    event: REALTIME_EVENTS.SETTLEMENT_CANCELLED,
    groupId: req.group!.id,
    actorId: req.user!.id,
    actorName: req.user!.fullName,
    entityId: settlement.id,
    message: `${req.user!.fullName} cancelled a settlement`,
  });

  sendOk(res, { settlement: publicSettlement(settlement, req.user!.id) });
};

export const listSettlements = async (req: Request, res: Response): Promise<void> => {
  const { status, limit, offset } = listSettlementsQuerySchema.parse(req.query);

  const { rows, total } = await settlementService.listSettlements({
    groupId: req.group!.id,
    status,
    limit,
    offset,
  });

  sendOk(res, {
    settlements: rows.map((row) => publicSettlement(row.settlement, req.user!.id)),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
};

/**
 * How much the caller may still settle with one specific person.
 *
 * The settle dialog pre-fills from this rather than from any client-side figure, so the
 * amount offered always matches what the server will accept.
 */
export const getOutstanding = async (req: Request, res: Response): Promise<void> => {
  const counterpartId = String(req.params.userId);
  const groupId = req.group!.id;

  const [iOwePaise, theyOwePaise] = await Promise.all([
    getOutstandingBetween(groupId, req.user!.id, counterpartId),
    getOutstandingBetween(groupId, counterpartId, req.user!.id),
  ]);

  sendOk(res, {
    counterpartId,
    iOwePaise,
    iOwe: paiseToRupees(iOwePaise),
    theyOwePaise,
    theyOwe: paiseToRupees(theyOwePaise),
    /** Both directions are reported because the product never nets them. */
    maxSettleablePaise: iOwePaise,
  });
};

/** The dashboard's action centre: what needs this user's attention right now. */
export const getAttention = async (req: Request, res: Response): Promise<void> => {
  const groupId = req.group!.id;
  const [attention, balance] = await Promise.all([
    settlementService.getAttentionItems(groupId, req.user!.id),
    getUserBalanceSummary(groupId, req.user!.id),
  ]);

  const present = (items: Settlement[]) => items.map((s) => publicSettlement(s, req.user!.id));

  sendOk(res, {
    awaitingMyApproval: present(attention.awaitingMyApproval),
    awaitingTheirApproval: present(attention.awaitingTheirApproval),
    rejectedNeedingAction: present(attention.rejectedNeedingAction),
    myPromises: present(attention.myPromises),
    promisesToMe: present(attention.promisesToMe),
    totalActionable:
      attention.awaitingMyApproval.length + attention.rejectedNeedingAction.length,
    balances: {
      youNeedToPayTotalPaise: balance.youNeedToPayTotalPaise,
      youWillReceiveTotalPaise: balance.youWillReceiveTotalPaise,
      netBalancePaise: balance.netBalancePaise,
    },
  });
};

/* -------------------------------------------------------------------------- */
/* Settle-up plan                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Suggests the shortest route out of the group's current debts.
 *
 * Advice only: nothing here is stored, and the underlying ledger stays directional and
 * un-netted. Each transfer carries `recordablePaise` so the client can tell the
 * difference between "tap to settle this" and "this only works once someone else pays
 * first" -- rather than offering a button the settlement engine would reject.
 */
export const getSettlementPlan = async (req: Request, res: Response): Promise<void> => {
  const groupId = req.group!.id;

  const [plan, members] = await Promise.all([
    settlementPlanService.getSettlementPlan(groupId),
    groupService.listGroupMembers(groupId),
  ]);

  const byId = new Map(
    members.map((row) => [
      row.user.id,
      { id: row.user.id, fullName: row.user.fullName, email: row.user.email },
    ]),
  );

  const person = (userId: string) =>
    byId.get(userId) ?? { id: userId, fullName: 'Former member', email: '' };

  sendOk(res, {
    currentTransferCount: plan.currentTransferCount,
    suggestedTransferCount: plan.transfers.length,
    allSettled: plan.allSettled,
    transfers: plan.transfers.map((transfer) => ({
      from: person(transfer.fromUserId),
      to: person(transfer.toUserId),
      amountPaise: transfer.amountPaise,
      amount: paiseToRupees(transfer.amountPaise),
      recordablePaise: transfer.recordablePaise,
      recordable: transfer.recordablePaise >= transfer.amountPaise,
      involvesMe:
        transfer.fromUserId === req.user!.id || transfer.toUserId === req.user!.id,
    })),
    netPositions: plan.netPositions.map((position) => ({
      user: person(position.userId),
      netPaise: position.netPaise,
      net: paiseToRupees(position.netPaise),
      isMe: position.userId === req.user!.id,
    })),
  });
};
