import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  Crown,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Trash2,
  UserMinus,
  CalendarClock,
  Check,
  X,
  Ban,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ApiClientError, apiRequest } from '@/lib/api';
import { useGroups } from '@/context/GroupContext';
import { useRealtime } from '@/hooks/useRealtime';
import type { Pagination } from '@/types/domain';

/**
 * Group activity feed.
 *
 * Entries are stored as a type plus metadata rather than a sentence, so the wording is
 * composed here. Rows migrated from the legacy system carry `metadata.legacyAction` —
 * the original sentence — which is preferred when present so historical entries read
 * exactly as they always did rather than being flattened into a generic phrase.
 */

const PAGE_SIZE = 30;

interface ActivityEntry {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; fullName: string; email: string };
  isMe: boolean;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  group_created: Crown,
  member_joined: LogIn,
  member_left: LogOut,
  member_removed: UserMinus,
  invite_regenerated: QrCode,
  payday_updated: CalendarClock,
  expense_created: Plus,
  expense_updated: Pencil,
  expense_deleted: Trash2,
  settlement_created: Receipt,
  settlement_approved: Check,
  settlement_rejected: X,
  settlement_cancelled: Ban,
};

const TONES: Record<string, string> = {
  expense_created: 'bg-sky-50 text-sky-600',
  expense_updated: 'bg-amber-50 text-amber-600',
  expense_deleted: 'bg-red-50 text-red-600',
  settlement_created: 'bg-violet-50 text-violet-600',
  settlement_approved: 'bg-emerald-50 text-emerald-600',
  settlement_rejected: 'bg-red-50 text-red-600',
  settlement_cancelled: 'bg-slate-100 text-slate-500',
  member_joined: 'bg-emerald-50 text-emerald-600',
  member_left: 'bg-slate-100 text-slate-500',
  member_removed: 'bg-red-50 text-red-600',
  group_created: 'bg-amber-50 text-amber-600',
  invite_regenerated: 'bg-slate-100 text-slate-500',
  payday_updated: 'bg-slate-100 text-slate-500',
};

/** Fallback wording for entries created by this system rather than migrated. */
const FALLBACK: Record<string, string> = {
  group_created: 'created the group',
  member_joined: 'joined the group',
  member_left: 'left the group',
  member_removed: 'removed a member',
  invite_regenerated: 'regenerated the group invite',
  payday_updated: 'updated the payday',
  expense_created: 'added an expense',
  expense_updated: 'updated an expense',
  expense_deleted: 'deleted an expense',
  settlement_created: 'recorded a payment',
  settlement_approved: 'confirmed a payment',
  settlement_rejected: 'could not confirm a payment',
  settlement_cancelled: 'cancelled a settlement',
};

const describe = (entry: ActivityEntry): string => {
  const legacy = entry.metadata?.legacyAction;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();

  const title = entry.metadata?.title;
  if (typeof title === 'string' && title.trim()) {
    if (entry.type === 'expense_created') return `added "${title}"`;
    if (entry.type === 'expense_updated') return `updated "${title}"`;
    if (entry.type === 'expense_deleted') return `deleted "${title}"`;
  }

  return FALLBACK[entry.type] ?? entry.type.replace(/_/g, ' ');
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Groups entries under a day heading, which is how people scan a timeline. */
const dayLabel = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      startOfToday.getTime()) /
      86_400_000,
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};

const timeLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export const ActivityPage: React.FC = () => {
  const { activeGroupId } = useGroups();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (!activeGroupId) return;
      if (append) setIsLoadingMore(true);
      setError(null);

      try {
        const data = await apiRequest<{
          activities: ActivityEntry[];
          pagination: Pagination;
        }>(`/api/groups/${activeGroupId}/activities?limit=${PAGE_SIZE}&offset=${offset}`);

        setEntries((prev) => (append ? [...prev, ...data.activities] : data.activities));
        setPagination(data.pagination);
      } catch (err: unknown) {
        setError(err instanceof ApiClientError ? err.message : 'Could not load activity.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeGroupId],
  );

  useEffect(() => {
    setIsLoading(true);
    void load(0, false);
  }, [load]);

  // Any group change produces an activity row, so refresh the top of the feed.
  useRealtime(
    activeGroupId,
    useCallback(() => void load(0, false), [load]),
  );

  let lastDay = '';

  return (
    <AppShell title="Activity">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-slate-400" />
          <h2 className="t-subtitle">
            {pagination ? `${pagination.total} entries` : 'Group activity'}
          </h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-600">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => load(0, false)}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-4 p-4">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <ActivityIcon className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No activity yet</p>
              <p className="mx-auto mt-1 max-w-xs t-meta">
                Adding expenses and settling up will show up here.
              </p>
            </div>
          ) : (
            <ul>
              {entries.map((entry) => {
                const day = dayLabel(entry.createdAt);
                const showDay = day !== lastDay;
                lastDay = day;
                const Icon = ICONS[entry.type] ?? ActivityIcon;

                return (
                  <React.Fragment key={entry.id}>
                    {showDay && (
                      <li className="sticky top-14 z-10 border-y border-slate-100 bg-slate-50/95 px-4 py-1.5 backdrop-blur">
                        <span className="t-eyebrow">{day}</span>
                      </li>
                    )}
                    <li className="flex items-start gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          TONES[entry.type] ?? 'bg-slate-100 text-slate-500',
                        )}
                        aria-hidden
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">
                            {entry.isMe ? 'You' : entry.actor.fullName}
                          </span>{' '}
                          {describe(entry)}
                        </p>
                        <p className="t-meta">{timeLabel(entry.createdAt)}</p>
                      </div>

                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {initials(entry.actor.fullName)}
                        </AvatarFallback>
                      </Avatar>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          )}

          {pagination?.hasMore && (
            <div className="border-t border-slate-100 p-3">
              <Button
                variant="outline"
                className="w-full"
                disabled={isLoadingMore}
                onClick={() => void load(entries.length, true)}
              >
                {isLoadingMore ? 'Loading…' : 'Load older activity'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
