import type { Activity } from '@/api/types';
import type { IconName } from '@/components/Icon';
import { formatPaise } from '@/lib/money';

/**
 * How one activity entry reads in the feed.
 *
 * WRITTEN FROM WHAT THE SERVER RECORDED, AND NOTHING MORE. Each event type carries its own
 * metadata (see the `insert(activities)` calls in the server's services), and this only
 * uses what that type actually stores. A settlement rejection records no payer, so it does
 * not name one; a settlement's creation records the status it was created with, so a
 * promise reads as a promise — never as a payment.
 *
 * HISTORY STAYS HISTORY. An entry describes the moment it was written. "Sent for
 * confirmation" is what happened when a payment was recorded; whether it was confirmed
 * later is a separate event, and this entry does not borrow its outcome.
 *
 * Older imported entries carry their original sentence in `legacyAction`, and that
 * sentence is shown as it was rather than being re-classified.
 */

export type ActivityTone = 'expense' | 'payment' | 'member' | 'group' | 'negative';

export type ActivityView = {
  /** Everything after the actor: 'added “Dinner”'. */
  action: string;
  icon: IconName;
  tone: ActivityTone;
  /** Paise, only when this event type records an amount. */
  amountPaise: number | null;
  /** One quiet line of context the metadata supports: "was ₹500", a rejection reason. */
  note: string | null;
  /** An existing route, or null when there is nothing (left) to open. */
  destination: string | null;
  /** Money moved or was claimed to — these carry a little more weight in the feed. */
  emphasis: boolean;
};

/** The server's thirteen activity types, as labels for the filter sheet. */
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  expense_created: 'Expense added',
  expense_updated: 'Expense edited',
  expense_deleted: 'Expense deleted',
  settlement_created: 'Payment recorded',
  settlement_approved: 'Payment confirmed',
  settlement_rejected: 'Payment rejected',
  settlement_cancelled: 'Payment cancelled',
  member_joined: 'Member joined',
  member_left: 'Member left',
  member_removed: 'Member removed',
  group_created: 'Group created',
  invite_regenerated: 'Invite code changed',
  payday_updated: 'Payday changed',
};

/** The filter sheet's headings. Presentation only: each option is still one exact type. */
export const ACTIVITY_TYPE_GROUPS: { title: string; types: string[] }[] = [
  { title: 'Expenses', types: ['expense_created', 'expense_updated', 'expense_deleted'] },
  {
    title: 'Payments',
    types: ['settlement_created', 'settlement_approved', 'settlement_rejected', 'settlement_cancelled'],
  },
  { title: 'Members', types: ['member_joined', 'member_left', 'member_removed'] },
  { title: 'Group', types: ['group_created', 'invite_regenerated', 'payday_updated'] },
];

export const activityTypeLabel = (type: string): string =>
  ACTIVITY_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const paise = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return n + 'th';
  return n + (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
};

/**
 * @param nameOf  A group member's name, or null when the id is no longer in the group.
 *                Unknown people are described generically rather than as a wrong name.
 * @param viewerId  So the viewer is "you" wherever they appear as the object of a sentence.
 */
export function describeActivityEntry(
  entry: Activity,
  groupId: string,
  nameOf: (id: string) => string | null,
  viewerId: string | null | undefined,
): ActivityView {
  const meta = entry.metadata ?? {};
  const base = '/group/' + groupId;
  const person = (id: unknown): string | null => {
    if (typeof id !== 'string') return null;
    if (viewerId && id === viewerId) return 'you';
    return nameOf(id);
  };
  const title = text(meta.title);
  const quoted = title ? '“' + title + '”' : null;
  const amountPaise = paise(meta.amountPaise);

  const toExpense = entry.entityType === 'expense' && entry.entityId ? base + '/expense/' + entry.entityId : null;
  const toSettlement =
    entry.entityType === 'settlement' && entry.entityId ? base + '/settlement/' + entry.entityId : null;

  const view = (partial: Partial<ActivityView> & Pick<ActivityView, 'action' | 'icon' | 'tone'>): ActivityView => ({
    amountPaise: null,
    note: null,
    destination: null,
    emphasis: false,
    ...partial,
  });

  const legacy = text(meta.legacyAction);
  if (legacy) {
    const family = entry.type.startsWith('expense')
      ? { icon: 'expense' as IconName, tone: 'expense' as ActivityTone, destination: entry.type === 'expense_deleted' ? null : toExpense }
      : entry.type.startsWith('settlement')
        ? { icon: 'settlement' as IconName, tone: 'payment' as ActivityTone, destination: toSettlement }
        : { icon: 'activity' as IconName, tone: 'group' as ActivityTone, destination: null };
    return view({ action: legacy, amountPaise, ...family });
  }

  switch (entry.type) {
    case 'expense_created':
      return view({
        action: quoted ? 'added ' + quoted : 'added an expense',
        icon: 'add',
        tone: 'expense',
        amountPaise,
        destination: toExpense,
        emphasis: true,
      });

    case 'expense_updated': {
      const previous = paise(meta.previousAmountPaise);
      return view({
        action: quoted ? 'edited ' + quoted : 'edited an expense',
        icon: 'edit',
        tone: 'expense',
        amountPaise,
        note:
          previous !== null && amountPaise !== null && previous !== amountPaise
            ? 'Was ' + formatPaise(previous, { compact: true })
            : null,
        destination: toExpense,
      });
    }

    case 'expense_deleted':
      return view({
        action: quoted ? 'deleted ' + quoted : 'deleted an expense',
        icon: 'trash',
        tone: 'negative',
        amountPaise,
        // The expense is gone; there is nothing to open.
        destination: null,
      });

    case 'settlement_created': {
      const receiver = person(meta.receiverId);
      const promise = meta.status === 'will_pay_soon';
      return view({
        action: promise
          ? 'promised to pay ' + (receiver ?? 'someone')
          : 'recorded a payment to ' + (receiver ?? 'someone'),
        icon: promise ? 'calendar' : 'settlement',
        tone: 'payment',
        amountPaise,
        note: promise ? 'A promise — no money moved' : 'Sent for confirmation',
        destination: toSettlement,
        emphasis: !promise,
      });
    }

    case 'settlement_approved': {
      const payer = person(meta.payerId);
      return view({
        action:
          payer === 'you'
            ? 'confirmed your payment'
            : payer
              ? 'confirmed ' + payer + '’s payment'
              : 'confirmed a payment',
        icon: 'checkCircle',
        tone: 'payment',
        amountPaise,
        destination: toSettlement,
        emphasis: true,
      });
    }

    case 'settlement_rejected':
      return view({
        // The record stores no payer for a rejection, so none is named.
        action: 'rejected a payment',
        icon: 'alertCircle',
        tone: 'negative',
        amountPaise,
        note: text(meta.reason),
        destination: toSettlement,
      });

    case 'settlement_cancelled':
      return view({
        action: 'cancelled a payment',
        icon: 'close',
        tone: 'group',
        amountPaise,
        destination: toSettlement,
      });

    case 'member_joined':
      return view({ action: 'joined the group', icon: 'userPlus', tone: 'member' });

    case 'member_left': {
      const successor = person(meta.creatorTransferredTo);
      return view({
        action: 'left the group',
        icon: 'signOut',
        tone: 'member',
        note: successor ? (successor === 'you' ? 'You became the creator' : successor + ' became the creator') : null,
      });
    }

    case 'member_removed': {
      const target = entry.entityType === 'user' ? person(entry.entityId) : null;
      return view({
        action: target ? 'removed ' + target + ' from the group' : 'removed a member',
        icon: 'user',
        tone: 'member',
      });
    }

    case 'group_created': {
      const name = text(meta.groupName);
      return view({ action: name ? 'created “' + name + '”' : 'created the group', icon: 'group', tone: 'group' });
    }

    case 'invite_regenerated':
      return view({ action: 'made a new invite code', icon: 'key', tone: 'group' });

    case 'payday_updated': {
      const day = typeof meta.payday === 'number' ? meta.payday : null;
      return view({
        action: day ? 'set payday to the ' + ordinal(day) + ' of the month' : 'turned off the payday',
        icon: 'calendar',
        tone: 'group',
      });
    }

    default:
      return view({ action: entry.type.replace(/_/g, ' '), icon: 'activity', tone: 'group' });
  }
}
