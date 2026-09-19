import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

/**
 * Notification bell.
 *
 * The unread count refreshes on open and on a slow interval; it is a single indexed
 * COUNT, so polling is cheap. The list itself is fetched only when the panel opens,
 * which keeps the dashboard's initial load free of work nobody has asked to see yet.
 */

const POLL_INTERVAL_MS = 60_000;

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
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const data = await apiRequest<{ unreadCount: number }>('/api/notifications/unread-count');
      setUnreadCount(data.unreadCount);
    } catch {
      // A failed count is not worth surfacing; the badge simply stays as it was.
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = setInterval(() => void refreshCount(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshCount]);

  const loadList = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>('/api/notifications?limit=20');
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void loadList();
  };

  const markAllRead = async () => {
    if (isMarking || unreadCount === 0) return;
    setIsMarking(true);
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setItems((prev) => prev?.map((item) => ({ ...item, isRead: true })) ?? prev);
    } catch {
      // Leave the list as-is; the next open will re-sync.
    } finally {
      setIsMarking(false);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      setItems((prev) =>
        prev?.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)) ?? prev,
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      void apiRequest('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ ids: [item.id] }),
      }).catch(() => undefined);
    }

    setOpen(false);

    // Route to whatever the notification is about.
    if (item.entityType === 'expense') navigate('/app/expenses');
    else if (item.entityType === 'settlement') navigate('/app/settlements');
    else if (item.entityType === 'group') navigate('/app/members');
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
          <span className="text-sm font-bold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              disabled={isMarking}
              className="h-8 text-xs"
            >
              {isMarking ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[min(24rem,60dvh)] overflow-y-auto overscroll-contain">
          {isLoading && items === null ? (
            <div className="space-y-3 p-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : (items?.length ?? 0) === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-500">
                You are all caught up.
              </p>
            </div>
          ) : (
            <ul>
              {items?.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(item)}
                    className={cn(
                      'flex w-full gap-2.5 border-b border-slate-100 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50',
                      !item.isRead && 'bg-primary/5',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        item.isRead ? 'bg-transparent' : 'bg-primary',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                        {item.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
