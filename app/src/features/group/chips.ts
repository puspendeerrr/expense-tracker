import type { SMChip } from '@/components/sm';
import { settlementStatusLabel } from '@/components/sm';

/** How the server's status values map onto the chip palette. */
const STATUS_TONE: Record<string, SMChip['tone']> = {
  completed: 'success',
  paid_pending_approval: 'warning',
  will_pay_soon: 'info',
  rejected: 'danger',
  cancelled: 'neutral',
};

/**
 * The chips under a settlement: what happened to it, how it was paid, and whether there is
 * proof attached.
 *
 * Shared by Overview and the Settlements section so one payment cannot describe itself two
 * different ways depending on which list it appears in. The wording comes from
 * SETTLEMENT_STATUS_LABELS, which is the server's vocabulary rather than ours.
 */
export function settlementChips(settlement: {
  status: string;
  paymentMethod: string;
  hasProof: boolean;
}): SMChip[] {
  const chips: SMChip[] = [
    {
      // Same wording as the status pill on the detail screen, so a state reads identically everywhere.
      label: settlementStatusLabel(settlement.status),
      tone: STATUS_TONE[settlement.status] ?? 'neutral',
    },
    { label: settlement.paymentMethod === 'upi' ? 'UPI' : 'Cash', tone: 'neutral' },
  ];

  if (settlement.hasProof) chips.push({ label: 'Proof', tone: 'info' });

  return chips;
}

/**
 * How one settlement is described to one viewer: its title and which way its amount leans.
 *
 * THREE PARTIES, NOT TWO. The settlement list returns every settlement in the group, not
 * only the viewer's own, and the server marks anything the viewer did not pay as
 * "incoming" — including payments between two OTHER members. The previous rows turned that
 * into "Vishal paid you" for a payment Vishal made to Dikshu. Here the viewer's own role is
 * worked out from the ids, and a payment between others is described as exactly that.
 *
 * A PROMISE IS NOT A PAYMENT. `will_pay_soon` records an intention, so it is worded as a
 * future ("You'll pay Rahul"), never as "You paid Rahul".
 *
 * The tone only tints the amount — out, in, or neither — and never carries the meaning
 * alone; the title always says it in words.
 */
export function describeSettlement(
  settlement: { payerId: string; receiverId: string; status: string },
  viewerId: string | null | undefined,
  nameOf: (id: string) => string,
): { title: string; tone: 'negative' | 'positive' | 'neutral' } {
  const payer = nameOf(settlement.payerId);
  const receiver = nameOf(settlement.receiverId);
  const promise = settlement.status === 'will_pay_soon';

  if (viewerId && settlement.payerId === viewerId) {
    return { title: promise ? 'You’ll pay ' + receiver : 'You paid ' + receiver, tone: 'negative' };
  }
  if (viewerId && settlement.receiverId === viewerId) {
    return { title: promise ? payer + ' will pay you' : payer + ' paid you', tone: 'positive' };
  }
  return { title: promise ? payer + ' will pay ' + receiver : payer + ' paid ' + receiver, tone: 'neutral' };
}
