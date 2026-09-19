import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Receipt, Search, Shield, Users2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { globalSearch, type GlobalSearchResult } from '@/lib/adminApi';
import { formatPaise } from '@/lib/money';

/**
 * Platform-wide search.
 *
 * Debounced, and every in-flight request is abortable: typing quickly otherwise leaves
 * several responses racing, and the slowest one wins regardless of what is now in the
 * box.
 */

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

interface AdminSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AdminSearch: React.FC<AdminSearchProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < MIN_LENGTH) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    const timer = window.setTimeout(() => {
      void globalSearch(trimmed, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setResults(data);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults(null);
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

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const total =
    (results?.users.length ?? 0) +
    (results?.groups.length ?? 0) +
    (results?.expenses.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="People, groups or expenses"
              className="pl-9"
              aria-label="Search the platform"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {term.trim().length > 0 && term.trim().length < MIN_LENGTH && (
            <p className="text-sm text-muted-foreground">
              Type at least {MIN_LENGTH} characters.
            </p>
          )}

          {results && total === 0 && !isSearching && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing matched &ldquo;{term.trim()}&rdquo;.
            </p>
          )}

          {results && total > 0 && (
            <div className="space-y-4">
              {results.users.length > 0 && (
                <Section title="People" icon={Users2}>
                  {results.users.map((person) => (
                    <ResultRow
                      key={person.id}
                      title={person.fullName}
                      subtitle={person.email}
                      badge={person.status === 'disabled' ? 'Disabled' : undefined}
                      onClick={() => go(`/admin/users/${person.id}`)}
                    />
                  ))}
                </Section>
              )}

              {results.groups.length > 0 && (
                <Section title="Groups" icon={Shield}>
                  {results.groups.map((group) => (
                    <ResultRow
                      key={group.id}
                      title={group.name}
                      subtitle={group.inviteCode}
                      badge={group.status === 'disabled' ? 'Disabled' : undefined}
                      onClick={() => go(`/admin/groups/${group.id}`)}
                    />
                  ))}
                </Section>
              )}

              {results.expenses.length > 0 && (
                <Section title="Expenses" icon={Receipt}>
                  {results.expenses.map((expense) => (
                    <ResultRow
                      key={expense.id}
                      title={expense.title}
                      subtitle={formatPaise(expense.amountPaise)}
                      onClick={() => go(`/admin/groups/${expense.groupId}`)}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

const Section: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children }) => (
  <section>
    <div className="mb-1 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h3>
    </div>
    <div className="overflow-hidden rounded-xl border border-admin-border">{children}</div>
  </section>
);

const ResultRow: React.FC<{
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}> = ({ title, subtitle, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex min-h-[48px] w-full items-center gap-3 border-b border-admin-border px-3 py-2 text-left last:border-b-0',
      'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent',
    )}
  >
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold">{title}</p>
      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
    </div>
    {badge && (
      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
        {badge}
      </span>
    )}
  </button>
);
