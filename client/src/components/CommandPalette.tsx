import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CornerDownLeft,
  Loader2,
  Moon,
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  Sun,
  Users2,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { initialsOf } from '@/lib/names';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  countResults,
  search,
  MIN_SEARCH_LENGTH,
  type SearchResults,
} from '@/lib/searchApi';

/**
 * Command palette and global search, in one surface.
 *
 * Deliberately not two features. Someone pressing Ctrl-K does not know yet whether they
 * want to go somewhere, do something, or find something -- they start typing and expect
 * the right answer. Splitting commands and search into separate dialogs makes them
 * choose first, which is the one thing they cannot do.
 *
 * Commands match locally and appear instantly; search results arrive from the server
 * after a debounce and are appended beneath. That ordering is deliberate too: a command
 * is an action the person meant, a result is something they are looking for, and a
 * navigation item jumping around as async results land is how people activate the wrong
 * row.
 */

const DEBOUNCE_MS = 250;

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra words that should match this command without being shown. */
  keywords?: string;
  run: () => void;
  /** Hidden unless the account holds this capability. */
  permission?: string;
};

/** A row the user can move to and activate. */
type Row =
  | { kind: 'command'; key: string; command: Command }
  | { kind: 'result'; key: string; group: string; label: string; hint: string; icon: React.ComponentType<{ className?: string }>; avatar?: string | null; run: () => void };

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the Add Expense dialog on the dashboard, when one is mounted. */
  onAddExpense?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onAddExpense,
}) => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { setPreference, resolved } = useTheme();

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (path: string) => {
      onOpenChange(false);
      navigate(path);
    },
    [navigate, onOpenChange],
  );

  /* ---- Commands ---- */

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'add-expense',
        label: 'Add an expense',
        hint: 'Record a new expense',
        icon: Plus,
        keywords: 'new spend create bill',
        run: () => {
          onOpenChange(false);
          if (onAddExpense) onAddExpense();
          else navigate('/app?add=1');
        },
        permission: 'expenses.create',
      },
      {
        id: 'settle',
        label: 'Settle up',
        hint: 'Record a payment',
        icon: Wallet,
        keywords: 'pay repay settlement',
        run: () => go('/app/settlements'),
      },
      { id: 'dashboard', label: 'Dashboard', icon: Receipt, keywords: 'home overview balance', run: () => go('/app') },
      { id: 'expenses', label: 'Expenses', icon: Receipt, keywords: 'list spending', run: () => go('/app/expenses') },
      { id: 'members', label: 'Members & dues', icon: Users2, keywords: 'people who owes', run: () => go('/app/members') },
      { id: 'groups', label: 'Groups', icon: Users2, keywords: 'switch join create', run: () => go('/app/groups') },
      { id: 'activity', label: 'Activity', icon: Activity, keywords: 'history feed', run: () => go('/app/activity') },
      { id: 'notifications', label: 'Notifications', icon: Bell, keywords: 'alerts inbox', run: () => go('/app/notifications') },
      { id: 'security', label: 'Security', icon: Shield, keywords: 'devices sessions login history password', run: () => go('/app/security') },
      { id: 'settings', label: 'Settings', icon: Settings, keywords: 'preferences payday', run: () => go('/app/settings') },
      {
        id: 'theme',
        label: resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: resolved === 'dark' ? Sun : Moon,
        keywords: 'theme dark light appearance colour color',
        run: () => {
          setPreference(resolved === 'dark' ? 'light' : 'dark');
          onOpenChange(false);
        },
      },
      {
        id: 'theme-system',
        label: 'Use the system theme',
        icon: Settings,
        keywords: 'theme auto system',
        run: () => {
          setPreference('system');
          onOpenChange(false);
        },
      },
      {
        id: 'admin',
        label: 'Admin console',
        icon: Shield,
        keywords: 'platform manage',
        run: () => go('/admin'),
        permission: 'admin.access',
      },
    ],
    [go, navigate, onAddExpense, onOpenChange, resolved, setPreference],
  );

  const matchedCommands = useMemo(() => {
    const allowed = commands.filter((c) => !c.permission || can(c.permission));
    const needle = term.trim().toLowerCase();
    if (!needle) return allowed;

    return allowed.filter((c) =>
      `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(needle),
    );
  }, [commands, term, can]);

  /* ---- Search ---- */

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setResults(null);
      setIsSearching(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void search(trimmed, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setResults(data);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setResults(null);
          setError(err instanceof Error ? err.message : 'Search failed.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  /* ---- Rows ---- */

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = matchedCommands.map((command) => ({
      kind: 'command',
      key: `cmd-${command.id}`,
      command,
    }));

    if (!results) return out;

    for (const group of results.groups) {
      out.push({
        kind: 'result',
        key: `group-${group.id}`,
        group: 'Groups',
        label: group.name,
        hint: `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`,
        icon: Users2,
        avatar: group.avatarUrl,
        run: () => go('/app/groups'),
      });
    }

    for (const member of results.members) {
      out.push({
        kind: 'result',
        key: `member-${member.id}`,
        group: 'People',
        label: member.fullName,
        hint: `${member.email} · ${member.groupName}`,
        icon: Users2,
        run: () => go('/app/members'),
      });
    }

    for (const expense of results.expenses) {
      out.push({
        kind: 'result',
        key: `expense-${expense.id}`,
        group: 'Expenses',
        label: expense.title,
        hint: `${formatPaise(expense.amountPaise)} · ${expense.payerName} · ${expense.groupName}`,
        icon: Receipt,
        run: () => go('/app/expenses'),
      });
    }

    for (const settlement of results.settlements) {
      out.push({
        kind: 'result',
        key: `settlement-${settlement.id}`,
        group: 'Settlements',
        label: `${settlement.payerName} → ${settlement.receiverName ?? 'the group'}`,
        hint: `${formatPaise(settlement.amountPaise)} · ${settlement.status.replace(/_/g, ' ')}`,
        icon: Wallet,
        run: () => go('/app/settlements'),
      });
    }

    for (const entry of results.activity) {
      out.push({
        kind: 'result',
        key: `activity-${entry.id}`,
        group: 'Activity',
        label: `${entry.actorName} · ${entry.type.replace(/_/g, ' ')}`,
        hint: entry.groupName,
        icon: Activity,
        run: () => go('/app/activity'),
      });
    }

    return out;
  }, [matchedCommands, results, go]);

  // Any change to the list invalidates the highlighted index.
  useEffect(() => {
    setActive(0);
  }, [term, results]);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults(null);
      setError(null);
      setActive(0);
    }
  }, [open]);

  // Keep the highlighted row in view as the selection moves by keyboard.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (rows.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % rows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + rows.length) % rows.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(rows.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[active];
      if (row) (row.kind === 'command' ? row.command.run : row.run)();
    }
  };

  const total = countResults(results);
  const showEmpty =
    term.trim().length >= MIN_SEARCH_LENGTH &&
    !isSearching &&
    !error &&
    total === 0 &&
    matchedCommands.length === 0;

  /** Where each visual group heading falls in the flat row list. */
  const headings = new Map<number, string>();
  let lastGroup = '';
  rows.forEach((row, index) => {
    const group = row.kind === 'command' ? 'Actions' : row.group;
    if (group !== lastGroup) {
      headings.set(index, group);
      lastGroup = group;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search and commands</DialogTitle>
        </DialogHeader>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search or jump to…"
              aria-label="Search or run a command"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={rows[active] ? `row-${rows[active]!.key}` : undefined}
              role="combobox"
              className="pl-9 pr-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div
          ref={listRef}
          id="command-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {error && (
            <p role="alert" className="px-2 py-6 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          {showEmpty && (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Nothing matched &ldquo;{term.trim()}&rdquo;.
            </p>
          )}

          {rows.map((row, index) => {
            const heading = headings.get(index);
            const isActive = index === active;
            const Icon = row.kind === 'command' ? row.command.icon : row.icon;
            const label = row.kind === 'command' ? row.command.label : row.label;
            const hint = row.kind === 'command' ? row.command.hint : row.hint;

            return (
              <React.Fragment key={row.key}>
                {heading && (
                  <p className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground first:pt-1">
                    {heading}
                  </p>
                )}
                <button
                  type="button"
                  id={`row-${row.key}`}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onMouseMove={() => setActive(index)}
                  onClick={() => (row.kind === 'command' ? row.command.run() : row.run())}
                  className={cn(
                    'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left transition-colors',
                    'focus-visible:outline-none',
                    isActive ? 'bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  {row.kind === 'result' && row.avatar ? (
                    <img
                      src={row.avatar}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-md object-cover"
                    />
                  ) : row.kind === 'result' && row.group === 'People' ? (
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
                    >
                      {initialsOf(label)}
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{label}</span>
                    {hint && <span className="block truncate t-meta">{hint}</span>}
                  </span>

                  {isActive && (
                    <CornerDownLeft
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </button>
              </React.Fragment>
            );
          })}

          {term.trim().length > 0 && term.trim().length < MIN_SEARCH_LENGTH && (
            <p className="px-2 pt-3 t-meta">
              Type {MIN_SEARCH_LENGTH} characters to search your groups.
            </p>
          )}
        </div>

        <div className="hidden items-center gap-3 border-t border-border px-3 py-2 t-meta sm:flex">
          <span>
            <kbd className="rounded border border-border px-1 font-mono">↑</kbd>{' '}
            <kbd className="rounded border border-border px-1 font-mono">↓</kbd> to move
          </span>
          <span>
            <kbd className="rounded border border-border px-1 font-mono">↵</kbd> to open
          </span>
          <span>
            <kbd className="rounded border border-border px-1 font-mono">esc</kbd> to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
