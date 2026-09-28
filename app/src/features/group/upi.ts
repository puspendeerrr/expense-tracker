import { paiseToRupees } from '@/lib/money';

/**
 * The `upi://pay` link handed to the phone's UPI apps.
 *
 * Moved here unchanged from the previous Settle Up screen — the same fields, in the same
 * order, encoded the same way — so the redesign cannot alter what a payment app receives.
 *
 *   pa  payee address (the receiver's UPI ID)
 *   pn  payee name
 *   am  amount in rupees, from the integer paise the form holds
 *   cu  currency
 *   tn  transaction note
 *
 * Opening this link settles nothing. Android hands control to the payment app and reports
 * nothing back about the outcome, which is why SplitMoney then asks for a screenshot.
 */
export const buildUpiUri = (input: {
  upiId: string;
  payeeName: string;
  amountPaise: number;
  payerName: string;
}): string =>
  'upi://pay?pa=' +
  encodeURIComponent(input.upiId) +
  '&pn=' +
  encodeURIComponent(input.payeeName) +
  '&am=' +
  encodeURIComponent(String(paiseToRupees(Number.isFinite(input.amountPaise) ? input.amountPaise : 0))) +
  '&cu=INR&tn=' +
  encodeURIComponent('SplitMoney from ' + input.payerName);
