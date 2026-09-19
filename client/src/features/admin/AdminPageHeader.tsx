import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The header band every admin screen opens with.
 *
 * A consumer screen can get away with a bare title, because the user already knows why
 * they are there. An operator arriving at a console screen needs three things before
 * they touch anything: where they are in the hierarchy, what this screen governs, and
 * what the screen's own actions are. Those are the three rows below, in that order.
 *
 * Actions live here rather than scattered through the body so that "what can I do on
 * this page" has exactly one place to look.
 */

export interface Crumb {
  label: string;
  to?: string;
}

interface AdminPageHeaderProps {
  title: string;
  /** One line on what this screen governs. Not decoration -- it sets scope. */
  description?: string;
  crumbs?: Crumb[];
  /** Live figure for the current result set, e.g. "248 accounts". */
  count?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  crumbs,
  count,
  onRefresh,
  isRefreshing = false,
  actions,
}) => (
  <div className="mb-4 border-b border-admin-border pb-4">
    {crumbs && crumbs.length > 0 && (
      <nav aria-label="Breadcrumb" className="mb-1.5">
        <ol className="flex flex-wrap items-center gap-0.5 text-xs text-muted-foreground">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-0.5">
              {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  // A breadcrumb is still something people tap. The 44px target is real;
                  // the negative margin keeps it from padding the row out to match.
                  className="-my-3 inline-flex min-h-[44px] items-center truncate rounded px-1 font-medium hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate px-1 py-0.5 font-semibold text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )}

    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {count && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {(actions || onRefresh) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {onRefresh && (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Refresh this page"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          )}
        </div>
      )}
    </div>
  </div>
);
