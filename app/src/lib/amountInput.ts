/**
 * The largest figure the server accepts, in paise. MIRRORS `MAX_AMOUNT_PAISE` in
 * server/src/utils/money.ts (₹10 crore) so the form can say so before saving; the
 * server's check is the one that counts.
 */
export const MAX_AMOUNT_PAISE = 100_000_000_00;

/**
 * Whole-rupee digits allowed in the field. Nine covers the whole valid range (the maximum
 * is itself nine digits) without ever refusing a figure the server would accept; anything
 * the ninth digit allows above the maximum is caught by the range message instead.
 */
const MAX_WHOLE_DIGITS = 9;

/**
 * Keeps only what the server's rupee parser will accept.
 *
 * The server reads an amount with a plain `Number(value.trim())` and rejects anything
 * finer than a paisa. So this allows digits, at most one decimal point, and at most two
 * digits after it — and refuses every other keystroke outright.
 *
 * IT REFUSES; IT NEVER ROUNDS. A third decimal digit simply does not appear, so the figure
 * on screen is always exactly the figure that will be sent. Nothing typed is ever quietly
 * turned into a different number.
 *
 * COMMAS ARE REFUSED, NOT INTERPRETED. The previous form stripped commas when checking the
 * amount but sent the raw text, so "1,240" passed on the phone and was rejected by the
 * server (`Number("1,240")` is NaN). Guessing what a comma meant is worse: read as a
 * thousands separator, "12,50" becomes ₹1,250; read as a decimal point, "1,240" becomes
 * ₹1.24. Either guess can be off by a factor of a hundred or a thousand. Dropping the
 * keystroke leaves the digits visible and the confirmation line underneath shows exactly
 * what will be recorded, so any surprise is seen before saving rather than after.
 */
export const sanitizeAmount = (raw: string): string => {
  let whole = '';
  let fraction = '';
  let seenPoint = false;

  for (const char of raw) {
    const isDigit = char >= '0' && char <= '9';

    if (isDigit && seenPoint) {
      if (fraction.length < 2) fraction += char;
    } else if (isDigit) {
      // A lone leading zero is replaced by the next digit: "07" is 7, "00" is 0.
      if (whole === '0') whole = char;
      else if (whole.length < MAX_WHOLE_DIGITS) whole += char;
    } else if (char === '.' && !seenPoint) {
      seenPoint = true;
    }
    // Everything else — commas, signs, spaces, "e", currency symbols — is refused.
  }

  if (!seenPoint) return whole;

  // "." on its own reads as nothing, so it gets a leading zero and shows as "0.".
  return (whole === '' ? '0' : whole) + '.' + fraction;
};

/**
 * Keeps only a whole-number share weight: digits, no leading zeros, at most five of them.
 *
 * The server takes shares as integers from 0 to 10,000 (`shareWeightSchema`).
 *
 * STOPS AT A DECIMAL POINT. Shares are whole numbers, so a "." can only be a decimal
 * point, and skipping it would glue the digits either side together: a pasted "1.5" would
 * become 15, a tenfold larger share, with nothing on screen to suggest anything happened.
 * Stopping there gives 1 instead — it drops a fraction that a share cannot hold anyway,
 * and does so visibly. (The share keyboard has no "." key, so only a paste reaches this.)
 *
 * A comma, unlike a point, can be a thousands separator in a share ("1,000"), so it is
 * skipped rather than treated as the end of the number.
 */
export const sanitizeShares = (raw: string): string => {
  let digits = '';
  for (const char of raw) {
    if (char === '.') break;
    if (char < '0' || char > '9') continue;
    if (digits === '0') digits = char;
    else if (digits.length < 5) digits += char;
  }
  return digits;
};
