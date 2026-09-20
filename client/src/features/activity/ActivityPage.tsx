import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  Ban,
  CalendarClock,
  Check,
  ChevronDown,
  Crown,
  Filter,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Search,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ApiClientError, apiRequest } from '@/lib/api';
import { getGroup } from '@/lib/domainApi';
import { useGroups } from '@/context/GroupContext';
import { useRealtime } from '@/hooks/useRealtime';
import { formatPaise } from '@/lib/money';
import type { GroupMemberSummary, Pagination } from '@/types/domain';

/**
 * Group activity feed.
 *
 * Entries are stored as a type plus metadata rather than a sentence, so the wording is
 * composed here. Rows migrated from the legacy system carry `metadata.legacyAction` --
 * the original sentence -- which is preferred when present so historical entries read
 * exactly as they always did rather than being flattened into a generic phrase.
 *
 * Filtering is done by the server, not over the fetched page: the feed is paged, so
 * narrowing in the browser would report "3 results" for a group holding thirty matches
 * further down, which is worse than no filter at all because it looks like an answer.
 */

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

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
  expense_created: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  expense_updated: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  expense_deleted: 'bg-red-500/10 text-red-600 dark:text-red-400',
  settlement_created: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  settlement_approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  settlement_rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  settlement_cancelled: 'bg-muted text-muted-foreground',
  member_joined: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  member_left: 'bg-muted text-muted-foreground',
  member_removed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  group_created: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  invite_regenerated: 'bg-muted text-muted-foreground',
  payday_updated: 'bg-muted text-muted-foreground',
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

/** Human label for a raw type, used by the filter control. */
const typeLabel = (type: string): string => {
  const base = FALLBACK[type] ?? type.replace(/_/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
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

/**
 * The amount an entry moved, when it moved one.
 *
 * Read from whichever key the recording site used, because expense and settlement
 * entries were written by different services and never agreed on a name. Only integer
 * paise is accepted: a float here would mean someone recorded rupees, and rendering it
 * as paise would be off by a factor of a hundred.
 */
const amountOf = (entry: ActivityEntry): number | null => {
  for (const key of ['amountPaise', 'amount_paise', 'sharePaise']) {
    const value = entry.metadata?.[key];
    if (typeof value === 'number' && Number.isInteger(value) && value !== 0) return value;
  }
  return null;
};

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

/**
 * Where an activity entry leads, or null when it leads nowhere useful.
 *
 * Only entries that actually point at something become clickable. Making every row a
 * link -- including "the invite code was regenerated", which has no destination --
 * teaches people that clicking does nothing, and then they stop clicking the rows that
 * do lead somewhere.
 *
 * Deleted entities are the reason these are query parameters rather than path segments:
 * the destination still renders its list if the thing it points at is gone.
 */
const destinationFor = (entry: ActivityEntry): string | null => {
  if (entry.entityType === 'expense' && entry.entityId) {
    // A deleted expense has nothing to open, but its group's ledger still explains it.
    return entry.type === 'expense_deleted'
      ? '/app/expenses'
      : `/app/expenses?expense=${entry.entityId}`;
  }

  if (entry.entityType === 'settlement' && entry.entityId) {
    return `/app/settlements?settlement=${entry.entityId}`;
  }

  if (entry.entityType === 'user' && entry.entityId) {
    return `/app/members?member=${entry.entityId}`;
  }

  if (entry.type.startsWith('settlement_')) return '/app/settlements';
  if (entry.type.startsWith('expense_')) return '/app/expenses';
  if (entry.type.startsWith('member_')) return '/app/members';

  return null;
};

const ANY = 'all';

interface Filters {
  search: string;
  type: string;
  actorId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { search: '', type: ANY, actorId: ANY, from: '', to: '' };

export const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeGroupId } = useGroups();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);

  // Each fetch cancels the one before it; otherwise a slow reply for an old filter can
  // land after a fast reply for the current one and overwrite it.
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filters.type !== ANY) params.set('type', filters.type);
    if (filters.actorId !== ANY) params.set('actorId', filters.actorId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    return params.toString();
  }, [debouncedSearch, filters.type, filters.actorId, filters.from, filters.to]);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (!activeGroupId) return;

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);

      try {
        const data = await apiRequest<{
          activities: ActivityEntry[];
          pagination: Pagination;
        }>(`/api/groups/${activeGroupId}/activities?${query}&offset=${offset}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        setEntries((prev) => (append ? [...prev, ...data.activities] : data.activities));
        setPagination(data.pagination);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiClientError ? err.message : 'Could not load activity.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [activeGroupId, query],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  // Filter options come from the group itself, so the controls never offer a type no
  // one has ever done or a member who is not in this group.
  useEffect(() => {
    if (!activeGroupId) return;
    const controller = new AbortController();

    void apiRequest<{ types: string[] }>(
      `/api/groups/${activeGroupId}/activities/types`,
      { signal: controller.signal },
    )
      .then((data) => !controller.signal.aborted && setTypes(data.types))
      .catch(() => undefined);

    void getGroup(activeGroupId)
      .then((data) => !controller.signal.aborted && setMembers(data.members))
      .catch(() => undefined);

    return () => controller.abort();
  }, [activeGroupId]);

  // Any group change produces an activity row, so refresh the top of the feed.
  useRealtime(
    activeGroupId,
    useCallback(() => void load(0, false), [load]),
  );

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const activeChips = useMemo(() => {
    const chips: { key: keyof Filters; label: string }[] = [];
    if (filters.type !== ANY) chips.push({ key: 'type', label: typeLabel(filters.type) });
    if (filters.actorId !== ANY) {
      const person = members.find((m) => m.id === filters.actorId);
      chips.push({ key: 'actorId', label: person ? person.fullName : 'One person' });
    }
    if (filters.from) chips.push({ key: 'from', label: `From ${filters.from}` });
    if (filters.to) chips.push({ key: 'to', label: `Until ${filters.to}` });
    return chips;
  }, [filters, members]);

  const hasFilters = activeChips.length > 0 || debouncedSearch.length > 0;

  const clearFilter = (key: keyof Filters) =>
    setFilter(key, key === 'type' || key === 'actorId' ? ANY : '');

  /* ---- Day grouping, derived rather than tracked while rendering ---- */
  const days = useMemo(() => {
    const out: { label: string; rows: ActivityEntry[] }[] = [];
    for (const entry of entries) {
      const label = dayLabel(entry.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(entry);
      else out.push({ label, rows: [entry] });
    }
    return out;
  }, [entries]);

  const filterControls = (
    <>
      <Select value={filters.type} onValueChange={(value) => setFilter('type', value)}>
        <SelectTrigger className="h-11 w-full sm:w-auto sm:min-w-[150px]" aria-label="Filter by what happened">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Anything</SelectItem>
          {types.map((type) => (
            <SelectItem key={type} value={type}>
              {typeLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.actorId} onValueChange={(value) => setFilter('actorId', value)}>
        <SelectTrigger className="h-11 w-full sm:w-auto sm:min-w-[150px]" aria-label="Filter by person">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Anyone</SelectItem>
          {members.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Input
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => setFilter('from', event.target.value)}
          aria-label="From date"
          className="w-full sm:w-[150px]"
        />
        <span className="shrink-0 text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => setFilter('to', event.target.value)}
          aria-label="To date"
          className="w-full sm:w-[150px]"
        />
      </div>
    </>
  );

  return (
    <AppShell title="Activity">
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-5 sm:px-6">
        {/* ---- Search and filters ---- */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder="Search activity"
                aria-label="Search activity"
                className="pl-9"
              />
              {filters.search.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter('search', '')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              className="h-11 shrink-0"
              aria-expanded={isFilterOpen}
              onClick={() => setIsFilterOpen((open) => !open)}
            >
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filters</span>
              {activeChips.length > 0 && (
                <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                  {activeChips.length}
                </span>
              )}
              <ChevronDown
                className={cn(
                  'ml-1.5 h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none',
                  isFilterOpen && 'rotate-180',
                )}
              />
            </Button>
          </div>

          {/*
            * Animated open/close.
            *
            * The grid collapses from 1fr to 0fr, which transitions smoothly without
            * anyone having to measure the panel first -- a max-height guess is either
            * too small (content clips) or too large (the close looks delayed while the
            * empty space animates away). `invisible` keeps the collapsed panel out of
            * the tab order instead of leaving focusable controls at zero height.
            */}
          <div
            className={cn(
              'grid transition-all duration-200 ease-out motion-reduce:transition-none',
              isFilterOpen
                ? 'grid-rows-[1fr] opacity-100'
                : 'invisible grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
                {filterControls}
              </div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => clearFilter(chip.key)}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-2.5 pr-1.5 text-xs font-semibold transition-colors hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="max-w-[180px] truncate">{chip.label}</span>
                  <X className="h-3 w-3 shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="rounded px-2 py-1 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h2 className="t-subtitle">
            {pagination
              ? `${pagination.total} ${pagination.total === 1 ? 'entry' : 'entries'}${
                  hasFilters ? ' match' : ''
                }`
              : 'Group activity'}
          </h2>
        </div>

        {/* ---- Feed ---- */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => void load(0, false)}
              >
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
              <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-lg shadow-emerald-950/30">
                <ActivityIcon className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="mt-2 text-base font-semibold text-slate-100">
                {hasFilters ? 'Nothing matches those filters' : 'No activity yet'}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">
                {hasFilters
                  ? 'Try a wider date range, or clear the filters to see everything.'
                  : 'Adding expenses and settling up will show up here.'}
              </p>
              {hasFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {days.map((day) => (
                <React.Fragment key={day.label}>
                  <li className="border-y border-white/[0.08] bg-[#111827] px-4 py-2 first:border-t-0">
                    <span className="t-eyebrow text-slate-400">{day.label}</span>
                  </li>

                  {day.rows.map((entry) => {
                    const Icon = ICONS[entry.type] ?? ActivityIcon;
                    const amount = amountOf(entry);
                    const href = destinationFor(entry);

                    const body = (
                      <>
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                            TONES[entry.type] ?? 'bg-muted text-muted-foreground',
                          )}
                          aria-hidden
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground/80">
                            <span className="font-semibold text-foreground">
                              {entry.isMe ? 'You' : entry.actor.fullName}
                            </span>{' '}
                            {describe(entry)}
                          </p>
                          <p className="t-meta">{timeLabel(entry.createdAt)}</p>
                        </div>

                        {amount !== null && (
                          <span className="t-money shrink-0 text-sm">
                            {formatPaise(amount)}
                          </span>
                        )}
                      </>
                    );

                    return (
                      <li key={entry.id}>
                        {href ? (
                          <button
                            type="button"
                            onClick={() => navigate(href)}
                            aria-label={`${entry.isMe ? 'You' : entry.actor.fullName} ${describe(entry)}`}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent"
                          >
                            {body}
                          </button>
                        ) : (
                          // No destination, so it is not dressed up as something to press.
                          <div className="flex items-center gap-3 px-4 py-2.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
            </ul>
          )}

          {pagination?.hasMore && (
            <div className="border-t border-border p-3">
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
