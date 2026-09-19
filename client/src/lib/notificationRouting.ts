import {
  AlertTriangle,
  Bell,
  Receipt,
  ShieldAlert,
  UserPlus,
  Wallet,
} from 'lucide-react';

/**
 * Where a notification goes, and how loudly it should ask to be read.
 *
 * One definition, used by the bell and the notifications screen alike. The mapping from
 * a notification's type to a destination is the kind of thing that silently rots when
 * it is written twice: one copy gains a case, the other does not, and the same
 * notification lands somewhere different depending on where it was clicked.
 *
 * Deep links carry the entity id as a query parameter rather than a path segment, so a
 * destination is always a real page that renders correctly on its own. A link to
 * `/app/settlements?settlement=<id>` still shows the settlements list if the row has
 * since been deleted, where `/app/settlements/<id>` would be a dead end.
 */

export type NotificationPriority = 'critical' | 'action' | 'info';

export interface NotificationLike {
  type: string;
  entityType: string | null;
  entityId: string | null;
  groupId: string | null;
}

export interface NotificationMeta {
  priority: NotificationPriority;
  /** Short category label, shown as a chip. */
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Where clicking should land. */
  href: string;
}

const PRIORITY: Record<string, NotificationPriority> = {
  security_new_device: 'critical',
  security_password_changed: 'critical',
  security_session_revoked: 'critical',

  settlement_requested: 'action',
  settlement_rejected: 'action',
  payment_reminder: 'action',

  settlement_approved: 'info',
  expense_added: 'info',
  expense_updated: 'info',
  expense_deleted: 'info',
  member_joined: 'info',
};

const CATEGORY: Record<string, string> = {
  security_new_device: 'Security',
  security_password_changed: 'Security',
  security_session_revoked: 'Security',
  settlement_requested: 'Settlement',
  settlement_approved: 'Settlement',
  settlement_rejected: 'Settlement',
  payment_reminder: 'Payment',
  expense_added: 'Expense',
  expense_updated: 'Expense',
  expense_deleted: 'Expense',
  member_joined: 'Group',
};

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  security_new_device: ShieldAlert,
  security_password_changed: ShieldAlert,
  security_session_revoked: ShieldAlert,
  settlement_requested: Wallet,
  settlement_approved: Wallet,
  settlement_rejected: AlertTriangle,
  payment_reminder: AlertTriangle,
  expense_added: Receipt,
  expense_updated: Receipt,
  expense_deleted: Receipt,
  member_joined: UserPlus,
};

/**
 * The destination for a notification.
 *
 * Falls back from the most specific thing we know to the least: a named entity, then
 * the screen that entity lives on, then the dashboard. A notification that cannot say
 * where it points is still clickable and still lands somewhere sensible.
 */
const destination = (notification: NotificationLike): string => {
  const { type, entityType, entityId } = notification;

  if (type.startsWith('security_')) return '/app/security';

  if (entityType === 'settlement' && entityId) {
    return `/app/settlements?settlement=${entityId}`;
  }
  if (entityType === 'expense' && entityId) {
    return `/app/expenses?expense=${entityId}`;
  }
  if (entityType === 'user' && entityId) {
    return `/app/members?member=${entityId}`;
  }
  if (entityType === 'group') return '/app/members';

  // No entity: send them to the screen the type belongs to.
  if (type.startsWith('settlement_') || type === 'payment_reminder') {
    return '/app/settlements';
  }
  if (type.startsWith('expense_')) return '/app/expenses';
  if (type === 'member_joined') return '/app/members';

  return '/app';
};

export const notificationMeta = (notification: NotificationLike): NotificationMeta => ({
  priority: PRIORITY[notification.type] ?? 'info',
  category: CATEGORY[notification.type] ?? 'Update',
  icon: ICON[notification.type] ?? Bell,
  href: destination(notification),
});

/**
 * Tailwind classes for a priority's icon badge.
 *
 * Three levels, two of which are coloured. Colouring all three would leave nothing to
 * stand out against, which is the usual way a priority system ends up meaning nothing.
 */
export const priorityTone = (priority: NotificationPriority): string => {
  if (priority === 'critical') return 'bg-destructive/10 text-destructive';
  if (priority === 'action') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-muted text-muted-foreground';
};

export const priorityLabel = (priority: NotificationPriority): string => {
  if (priority === 'critical') return 'Security';
  if (priority === 'action') return 'Needs action';
  return 'Update';
};

/**
 * Collapses runs of the same kind of notification from the same group.
 *
 * Five "expense added" rows from one group on one day is one piece of news, not five,
 * and a list that reports it five times pushes everything else off the screen. Only
 * consecutive items are grouped, so the feed stays in strict time order and nothing is
 * reordered to make a group look bigger.
 *
 * Security notifications are never grouped: each one is a separate event someone may
 * need to act on individually.
 */
export const groupNotifications = <T extends NotificationLike & { id: string; createdAt: string }>(
  items: T[],
): { key: string; items: T[] }[] => {
  const out: { key: string; items: T[] }[] = [];

  for (const item of items) {
    const groupable =
      !item.type.startsWith('security_') &&
      (item.type === 'expense_added' || item.type === 'expense_updated');

    const last = out[out.length - 1];
    const sameRun =
      last &&
      groupable &&
      last.items[0]!.type === item.type &&
      last.items[0]!.groupId === item.groupId &&
      !last.items[0]!.type.startsWith('security_');

    if (sameRun) last.items.push(item);
    else out.push({ key: item.id, items: [item] });
  }

  return out;
};
