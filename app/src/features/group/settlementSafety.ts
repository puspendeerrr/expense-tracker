import { settlements as settlementsApi } from '@/api/endpoints';
import type { Settlement } from '@/api/types';

/**
 * Guards against recording the same payment twice.
 *
 * WHY THE CLIENT HAS TO CARE. The server subtracts only COMPLETED settlements from what is
 * owed, so a pending payment does not lower the ceiling on the next one. Two pending
 * payments for the same full amount are therefore both accepted — there is no server-side
 * idempotency to catch a repeat.
 *
 * The dangerous moment is a submission whose outcome is unknown: the request left the
 * phone, and then the connection dropped or timed out. The server may well have recorded
 * it. Offering a plain "Try again" at that point is how duplicates are made.
 *
 * These helpers only READ. They never create, change or cancel anything; they just look
 * for evidence of what already happened, so the screen can say so instead of guessing.
 */

/** How far back a matching settlement still counts as "the one you just sent". */
const RECENT_MS = 10 * 60 * 1000;

const matches = (
  settlement: Settlement,
  input: { payerId: string; receiverId: string; amountPaise: number; status: string },
): boolean =>
  settlement.payerId === input.payerId &&
  settlement.receiverId === input.receiverId &&
  settlement.amountPaise === input.amountPaise &&
  settlement.status === input.status;

/**
 * After an uncertain failure, finds the settlement the server may have recorded anyway.
 *
 * Matches on payer, receiver, exact amount and the status a new record would have, created
 * in the last few minutes. Returns it if found — the submission succeeded — or null if the
 * server shows no sign of it, in which case retrying cannot duplicate anything.
 */
export async function findJustRecorded(
  groupId: string,
  input: { payerId: string; receiverId: string; amountPaise: number; status: string },
): Promise<Settlement | null> {
  const { settlements } = await settlementsApi.list(groupId, { status: input.status, limit: 20 });
  const now = Date.now();
  return (
    settlements.find(
      (settlement) =>
        matches(settlement, input) && now - new Date(settlement.createdAt).getTime() < RECENT_MS,
    ) ?? null
  );
}

/**
 * Payments from the viewer to one person that are still waiting to be confirmed.
 *
 * Shown before a new payment is recorded, so someone who already sent ₹780 yesterday is
 * reminded before sending it again. A reminder, not a block: two genuine part-payments are
 * perfectly legitimate.
 */
export async function pendingTo(
  groupId: string,
  payerId: string,
  receiverId: string,
  signal?: AbortSignal,
): Promise<Settlement[]> {
  const { settlements } = await settlementsApi.list(
    groupId,
    { status: 'paid_pending_approval', limit: 50 },
    signal,
  );
  return settlements.filter((s) => s.payerId === payerId && s.receiverId === receiverId);
}

/**
 * Loads one settlement by id.
 *
 * The API has no single-settlement route, so this pages through the group's list until it
 * finds it. The previous screen fetched only the 100 most recent and reported anything
 * older as "not found" — including a settlement opened from a notification about it.
 * Bounded at ten pages so a missing id cannot turn into an unbounded crawl.
 */
export async function loadSettlement(
  groupId: string,
  settlementId: string,
  signal?: AbortSignal,
): Promise<Settlement | null> {
  const PAGE = 100;
  for (let page = 0; page < 10; page += 1) {
    const { settlements, pagination } = await settlementsApi.list(
      groupId,
      { limit: PAGE, offset: page * PAGE },
      signal,
    );
    const found = settlements.find((s) => s.id === settlementId);
    if (found) return found;
    if (!pagination.hasMore) return null;
  }
  return null;
}
