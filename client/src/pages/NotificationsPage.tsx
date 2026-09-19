import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiClientError, apiRequest } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';
import { useGroups } from '@/context/GroupContext';
import {
  groupNotifications,
  notificationMeta,
  priorityLabel,
  priorityTone,
  type NotificationPriority,
} from '@/lib/notificationRouting';

/**
 * Every notification, in full.
 *
 * The bell shows the most recent handful; this is where someone comes to work through
 * the rest. Same routing and priority rules as the bell -- both read them from
 * `notificationRouting`, so a notification cannot land in two different places
 * depending on which surface it was clicked from.
 */

const PAGE_SIZE = 25;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  groupId: string | null;
  isRead: boolean;
  createdAt: string;
}

const relativeTime = (iso: string): string => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

type Filter = 'all' | 'unread' | NotificationPriority;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'critical', label: 'Security' },
  { value: 'action', label: 'Needs action' },
];

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeGroupId } = useGroups();

  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async (offset: number) => {
    setError(null);
    if (offset > 0) setIsLoadingMore(true);
    try {
      const data = await apiRequest<{
        notifications: NotificationItem[];
        pagination?: { hasMore: boolean };
      }>(`/api/notifications?limit=${PAGE_SIZE}&offset=${offset}`);

      setItems((prev) =>
        offset > 0 ? [...(prev ?? []), ...data.notifications] : data.notifications,
      );
      setHasMore(data.pagination?.hasMore ?? data.notifications.length === PAGE_SIZE);
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not load your notifications.',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  // A new expense or settlement produces a notification, so refresh the top of the list
  // rather than leaving it stale behind a realtime update the rest of the app just took.
  useRealtime(
    activeGroupId,
    useCallback(() => void load(0), [load]),
  );

  const open = async (item: NotificationItem) => {
    const { href } = notificationMeta(item);

    // Marked read first so the badge is already correct when the destination renders.
    // A failure here must not block the navigation: not being able to record that
    // something was read is no reason to refuse to show it.
    if (!item.isRead) {
      setItems((prev) =>
        (prev ?? []).map((row) => (row.id === item.id ? { ...row, isRead: true } : row)),
      );
      try {
        await apiRequest('/api/notifications/read', {
          method: 'POST',
          body: JSON.stringify({ ids: [item.id] }),
        });
      } catch {
        /* navigate anyway */
      }
    }

    navigate(href);
  };

  const markAllRead = async () => {
    setIsBusy(true);
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setItems((prev) => (prev ?? []).map((row) => ({ ...row, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not mark them read.');
    } finally {
      setIsBusy(false);
    }
  };

  const clearAll = async () => {
    setIsBusy(true);
    try {
      await apiRequest('/api/notifications', { method: 'DELETE' });
      setItems([]);
      setHasMore(false);
      toast.success('Notifications cleared');
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not clear them.');
    } finally {
      setIsBusy(false);
    }
  };

  const filtered = useMemo(() => {
    if (!items) return null;
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((item) => !item.isRead);
    return items.filter((item) => notificationMeta(item).priority === filter);
  }, [items, filter]);

  const grouped = useMemo(() => (filtered ? groupNotifications(filtered) : null), [filtered]);
  const unread = (items ?? []).filter((item) => !item.isRead).length;

  return (
    <AppShell
      title="Notifications"
      toolbar={
        <>
          <Button
            onClick={() => void markAllRead()}
            disabled={isBusy || unread === 0}
            className="h-11 flex-1 sm:flex-none"
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
          <Button
            variant="outline"
            onClick={() => void clearAll()}
            disabled={isBusy || (items ?? []).length === 0}
            className="h-11 shrink-0 px-3"
            aria-label="Clear all notifications"
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-5 sm:px-6">
        {/* ---- Filters ---- */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                'press min-h-[44px] rounded-lg border px-3 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              {option.label}
              {option.value === 'unread' && unread > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ---- List ---- */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-3 h-11" onClick={() => void load(0)}>
                Retry
              </Button>
            </div>
          ) : !grouped ? (
            <div className="space-y-3 p-3.5">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-44" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <Bell className="mx-auto h-9 w-9 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold text-foreground/80">
                {filter === 'all' ? 'Nothing here yet' : 'Nothing matches that filter'}
              </p>
              <p className="mx-auto mt-1 max-w-xs t-meta">
                {filter === 'all'
                  ? 'Expenses, settlements and security alerts will appear here.'
                  : 'Try a different filter.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {grouped.map(({ key, items: run }) => {
                const head = run[0]!;
                const meta = notificationMeta(head);
                const isRun = run.length > 1;
                const anyUnread = run.some((item) => !item.isRead);

                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => void open(head)}
                      className={cn(
                        'flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors',
                        'hover:bg-accent focus-visible:outline-none focus-visible:bg-accent',
                        anyUnread && 'bg-primary/[0.04]',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          priorityTone(meta.priority),
                        )}
                        aria-hidden
                      >
                        <meta.icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'truncate text-sm',
                              anyUnread ? 'font-bold' : 'font-semibold',
                            )}
                          >
                            {isRun ? `${run.length} ${meta.category.toLowerCase()} updates` : head.title}
                          </span>
                          {meta.priority !== 'info' && (
                            <span
                              className={cn(
                                'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                priorityTone(meta.priority),
                              )}
                            >
                              {priorityLabel(meta.priority)}
                            </span>
                          )}
                        </span>

                        <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                          {isRun
                            ? run
                                .slice(0, 3)
                                .map((item) => item.title)
                                .join(' · ')
                            : head.message}
                        </span>

                        <span className="mt-0.5 block t-meta">
                          {meta.category} · {relativeTime(head.createdAt)}
                        </span>
                      </span>

                      {anyUnread && (
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore && filter === 'all' && (
            <div className="border-t border-border p-3">
              <Button
                variant="outline"
                className="w-full"
                disabled={isLoadingMore}
                onClick={() => void load((items ?? []).length)}
              >
                {isLoadingMore ? 'Loading…' : 'Load older'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
