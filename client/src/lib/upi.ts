/**
 * UPI payment intents.
 *
 * Builds the NPCI-standard `upi://pay` URI. On an Android or iOS device with a UPI app
 * installed, opening this hands off to GPay / PhonePe / Paytm / BHIM with the payee,
 * amount and note pre-filled, so the payer only has to confirm. On desktop the same
 * string is rendered as a QR for scanning with a phone.
 *
 * Reference: NPCI UPI Linking Specification, section "Deep Linking".
 */

/**
 * A UPI ID (VPA) looks like `name@bank`.
 *
 * Deliberately permissive on the handle and strict on shape: banks use a wide variety of
 * handles (`@slc`, `@okhdfcbank`, `@ibl`), and many users' IDs are simply their phone
 * number. Rejecting a valid ID is worse than accepting an odd-looking one, because the
 * UPI app validates it again before any money moves.
 */
const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,63}$/;

export const isValidUpiId = (value: string | null | undefined): boolean =>
  typeof value === 'string' && VPA_PATTERN.test(value.trim());

export interface UpiIntentInput {
  /** Payee VPA. */
  upiId: string;
  /** Payee display name, shown in the UPI app's confirmation screen. */
  payeeName: string;
  /** Amount in paise; omitted from the URI when zero so the payer can enter it. */
  amountPaise?: number;
  /** Transaction note, e.g. the group name. */
  note?: string;
}

/**
 * Builds the `upi://pay` URI.
 *
 * The amount is formatted to exactly two decimals from integer paise: UPI rejects more
 * than two decimal places, and going via a float here would be the one place in the app
 * where a rounding error could change what someone is asked to pay.
 */
export const buildUpiIntent = (input: UpiIntentInput): string | null => {
  const upiId = input.upiId?.trim();
  if (!isValidUpiId(upiId)) return null;

  const params = new URLSearchParams();
  params.set('pa', upiId);
  params.set('pn', input.payeeName.trim() || 'SplitMoney');
  params.set('cu', 'INR');

  if (input.amountPaise && input.amountPaise > 0) {
    params.set('am', (input.amountPaise / 100).toFixed(2));
  }

  if (input.note) {
    // UPI notes are short and reject most punctuation; keep it plain and clipped.
    params.set('tn', input.note.replace(/[^\w\s-]/g, '').trim().slice(0, 50));
  }

  /*
   * URLSearchParams encodes spaces as "+", which some UPI apps pass through literally
   * into the payee name. %20 is understood everywhere.
   */
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
};

/**
 * Whether this device can plausibly hand off to a UPI app.
 *
 * Desktop browsers cannot, so they are offered a QR code instead of a dead link. The
 * check is coarse on purpose: a false positive merely shows a button that does nothing
 * visible, whereas a false negative hides the feature from someone who could use it.
 */
export const canOpenUpiApp = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
};

/** Human-readable payee label, falling back to the VPA when there is no name. */
export const upiDisplayName = (
  fullName: string | null | undefined,
  upiId: string | null | undefined,
): string => (fullName?.trim() ? fullName.trim() : (upiId?.split('@')[0] ?? 'Payee'));
