import type { ObjectId } from 'mongodb';

/**
 * Pure transforms from the legacy MongoDB shapes to the SplitWise domain.
 *
 * Kept free of I/O so each rule is directly testable, because these are the decisions
 * that determine whether migrated money is correct.
 */

export const oid = (value: unknown): string => String(value as ObjectId);

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

/** Legacy stored rupees as a float; paise is authoritative here. */
export const toPaise = (rupees: unknown): number => Math.round((Number(rupees) || 0) * 100);

export type ShareRow = { userId: string; sharePaise: number };

export type ReconcileResult = {
  participants: ShareRow[];
  /** Paise the stored shares were off by before repair. 0 when they already reconciled. */
  driftPaise: number;
  repaired: boolean;
};

/**
 * Makes an expense's participant shares sum exactly to its amount.
 *
 * The legacy edit path recomputed shares with per-row rounding instead of remainder
 * distribution, so 29 of this group's 238 expenses are off by one or two paise. The new
 * schema enforces reconciliation with a database trigger, so those rows cannot be
 * inserted as-is.
 *
 * The expense `amount` is what was actually spent and is therefore authoritative; the
 * stored shares are adjusted to match. The residual is applied one paisa at a time in a
 * stable order (largest share first, then user id) so the result is deterministic and no
 * single person absorbs more than a paisa more than necessary.
 */
export const reconcileShares = (
  amountPaise: number,
  rawShares: ShareRow[],
): ReconcileResult => {
  const participants = rawShares.map((row) => ({ ...row }));
  const sum = participants.reduce((total, row) => total + row.sharePaise, 0);
  const drift = sum - amountPaise;

  if (drift === 0 || participants.length === 0) {
    return { participants, driftPaise: 0, repaired: false };
  }

  // Stable ordering: biggest shares first, then user id as a tiebreak.
  const order = [...participants].sort(
    (a, b) => b.sharePaise - a.sharePaise || a.userId.localeCompare(b.userId),
  );

  let remaining = Math.abs(drift);
  const step = drift > 0 ? -1 : 1;

  // Multiple passes in case the residual exceeds the participant count.
  while (remaining > 0) {
    for (const row of order) {
      if (remaining === 0) break;
      // Never drive a share negative.
      if (step === -1 && row.sharePaise === 0) continue;
      row.sharePaise += step;
      remaining -= 1;
    }
  }

  return { participants, driftPaise: drift, repaired: true };
};

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** Minutes east of UTC used to resolve a stored instant to a calendar day. */
export const IST_OFFSET_MINUTES = 330;

/**
 * Converts a legacy timestamp to the calendar date the user meant.
 *
 * The legacy schema stored an instant; the new one stores a calendar date. Reading the
 * UTC date would shift every evening expense back a day for an IST user -- a ₹200 dinner
 * on the 12th would migrate as the 11th -- so the instant is shifted into local time
 * first. Default is IST because this group transacts in rupees via UPI.
 */
export const toCalendarDate = (
  value: unknown,
  offsetMinutes: number = IST_OFFSET_MINUTES,
): string => {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
};

export const toDate = (value: unknown, fallback: Date = new Date()): Date => {
  if (value instanceof Date) return value;
  if (value === null || value === undefined) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const toSplitType = (value: unknown): 'everyone' | 'specific' =>
  value === 'specific' ? 'specific' : 'everyone';

export const toPaymentMode = (value: unknown): 'cash' | 'upi' =>
  value === 'upi' ? 'upi' : 'cash';

export type SettlementStatus =
  | 'paid_pending_approval'
  | 'will_pay_soon'
  | 'completed'
  | 'rejected'
  | 'cancelled';

/**
 * Maps legacy settlement statuses, including the two retired ones the reference
 * rewrote lazily on every read (`verification_pending`, `expired`).
 */
export const toSettlementStatus = (value: unknown): SettlementStatus => {
  switch (String(value)) {
    case 'completed':
      return 'completed';
    case 'will_pay_soon':
      return 'will_pay_soon';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
    case 'expired':
      return 'cancelled';
    case 'paid_pending_approval':
    case 'verification_pending':
    default:
      return 'paid_pending_approval';
  }
};

export type NotificationType =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_requested'
  | 'settlement_approved'
  | 'settlement_rejected'
  | 'member_joined'
  | 'payment_reminder';

export const toNotificationType = (value: unknown): NotificationType => {
  const known: NotificationType[] = [
    'expense_added',
    'expense_updated',
    'expense_deleted',
    'settlement_requested',
    'settlement_approved',
    'settlement_rejected',
    'payment_reminder',
  ];
  const raw = String(value);
  if ((known as string[]).includes(raw)) return raw as NotificationType;
  if (raw === 'group_member_joined' || raw === 'member_joined') return 'member_joined';
  // group_invite / system_alert have no counterpart; the closest honest bucket.
  return 'payment_reminder';
};

export type ActivityType =
  | 'group_created'
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'invite_regenerated'
  | 'payday_updated'
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_created'
  | 'settlement_approved'
  | 'settlement_rejected'
  | 'settlement_cancelled';

/**
 * Classifies a legacy activity sentence.
 *
 * The reference stored pre-rendered English (`added "Dinner" ₹450`) rather than a type.
 * Each sentence is matched to the new enum, and the original text is preserved verbatim
 * in `metadata.legacyAction` so nothing is lost even where the classification is coarse.
 */
export const classifyActivity = (action: unknown): ActivityType => {
  const text = String(action ?? '').toLowerCase();

  if (text.startsWith('created group')) return 'group_created';
  if (text.includes('joined the group')) return 'member_joined';
  if (text.startsWith('added ')) return 'expense_created';
  if (text.startsWith('updated expense')) return 'expense_updated';
  if (text.startsWith('deleted expense')) return 'expense_deleted';
  if (text.includes('regenerated group')) return 'invite_regenerated';
  if (text.includes('payday') || text.includes('billing cycle')) return 'payday_updated';
  if (text.startsWith('approved ')) return 'settlement_approved';
  if (text.startsWith('rejected ')) return 'settlement_rejected';
  if (text.includes('cancelled')) return 'settlement_cancelled';
  // "marked ₹N as paid in cash to X", "paid ₹N via UPI to X", "promised to pay ₹N".
  if (
    text.startsWith('marked ') ||
    text.startsWith('paid ') ||
    text.startsWith('promised ') ||
    text.includes('payment proof')
  ) {
    return 'settlement_created';
  }
  if (text.includes('removed')) return 'member_removed';
  if (text.includes('left the group')) return 'member_left';

  return 'expense_created';
};

/** Normalised email, matching how the auth system stores it. */
export const normaliseEmail = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/** bcrypt hashes from the legacy system are reusable as-is, so passwords keep working. */
export const isBcryptHash = (value: unknown): boolean =>
  typeof value === 'string' && /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
