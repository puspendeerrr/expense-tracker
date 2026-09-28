import type { Group } from '@/api/types';

/**
 * Who may do what, as the ordinary user-facing screens understand it.
 *
 * ONE PLACE, SO EVERY SCREEN AGREES. The expense detail screen, the ledger's long-press
 * shortcut and the edit route all ask "may this person change this expense?". Answered in
 * three places, they drift, and a button appears on one screen that the next one refuses.
 *
 * THIS IS PRESENTATION, NOT SECURITY. Hiding a control only spares someone a request the
 * server would refuse anyway. Every rule below is enforced independently on the server,
 * and nothing here grants anything.
 */

/**
 * Whether the viewer may edit or delete an expense.
 *
 * Strictly the payer. The server's ordinary expense routes check `paid_by === actor` and
 * refuse everyone else with 403 — including platform admins, whose ownership bypass exists
 * only on the separate `/admin` routes this app never calls. Offering Edit to an admin here
 * would therefore produce exactly the "tap it and be refused" experience these rules exist
 * to prevent, so admins are deliberately not special-cased.
 */
export const canModifyExpense = (
  expense: { paidBy: string } | null | undefined,
  viewerId: string | null | undefined,
): boolean => Boolean(expense && viewerId && expense.paidBy === viewerId);

/**
 * Whether the viewer may change the group's name, description, photo or cover.
 *
 * Read from `role`, the viewer's membership role that the server computes per request —
 * NOT from `createdBy`. An admin can hand creator status to another member
 * (`POST /admin/groups/:groupId/transfer-creator`), after which
 * `createdBy` still names the original founder while the server's `requireGroupCreator`
 * checks the current membership role. Comparing against `createdBy` would show the editing
 * controls to the one person the server now refuses, and hide them from the one it allows.
 */
export const canEditGroup = (group: Pick<Group, 'role'> | null | undefined): boolean =>
  group?.role === 'creator';

/**
 * What the viewer may do to one settlement, mirroring `settlementService` exactly:
 *
 *   approve / reject   receiver only, while `paid_pending_approval`
 *   replace proof      payer only, while `paid_pending_approval` or `rejected`
 *                      (a new screenshot puts it back to pending)
 *   cancel             payer or receiver, while `paid_pending_approval`, `will_pay_soon`
 *                      or `rejected` — never once `completed`
 *
 * One refinement is presentational: a receiver is not offered "cancel" on a pending
 * payment, because Reject is the action that means "this did not arrive" and offering
 * both would ask them to choose between two buttons that sound the same. They can still
 * clear a promise that was never kept.
 *
 * Proof replacement is only offered for UPI, the one method where proof is part of the
 * record; a cash settlement has nothing to replace.
 */
export type SettlementActions = {
  approve: boolean;
  reject: boolean;
  replaceProof: boolean;
  cancel: boolean;
};

export const settlementActions = (
  settlement: {
    payerId: string;
    receiverId: string;
    status: string;
    paymentMethod: string;
  } | null | undefined,
  viewerId: string | null | undefined,
): SettlementActions => {
  const none = { approve: false, reject: false, replaceProof: false, cancel: false };
  if (!settlement || !viewerId) return none;

  const payer = settlement.payerId === viewerId;
  const receiver = settlement.receiverId === viewerId;
  const pending = settlement.status === 'paid_pending_approval';
  const promised = settlement.status === 'will_pay_soon';
  const rejected = settlement.status === 'rejected';

  return {
    approve: receiver && pending,
    reject: receiver && pending,
    replaceProof: payer && (pending || rejected) && settlement.paymentMethod === 'upi',
    cancel: (payer && (pending || promised || rejected)) || (receiver && promised),
  };
};
