import React from 'react';
import { ChevronLeft, ChevronRight, Inbox, Loader2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Shared list scaffolding for the admin console.
 *
 * One component owns the four states every list has -- loading, error, empty, populated
 * -- so no screen can forget one. Each screen supplies its own row rendering: a table
 * row for desktop and a card for mobile, rather than a table squeezed into 360px and
 * scrolled sideways.
 */

export type RowAction = {
  label: string;
  onSelect: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  /** Renders in the destructive colour and below a separator. */
  destructive?: boolean;
  disabled?: boolean;
  /** Explains why the action is unavailable, shown in place of the label's subtitle. */
  disabledReason?: string;
};

/**
 * Per-row contextual menu.
 *
 * Icon-only by necessity in a dense table, so it carries an explicit `aria-label`
 * naming the row it belongs to -- "More actions" repeated twenty times is useless to a
 * screen-reader user.
 */
export const RowActions: React.FC<{ label: string; actions: RowAction[] }> = ({
  label,
  actions,
}) => {
  const normal = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={`Actions for ${label}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {normal.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={action.onSelect}
            title={action.disabled ? action.disabledReason : undefined}
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </DropdownMenuItem>
        ))}

        {destructive.length > 0 && normal.length > 0 && <DropdownMenuSeparator />}

        {destructive.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={action.onSelect}
            title={action.disabled ? action.disabledReason : undefined}
            className="text-destructive focus:text-destructive"
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface DataViewProps<T> {
  rows: T[] | null;
  isLoading: boolean;
  isRefreshing?: boolean;
  error: string | null;
  onRetry: () => void;
  emptyTitle: string;
  emptyHint?: string;
  /** Column headers for the desktop table. */
  head: React.ReactNode;
  renderRow: (row: T, index: number) => React.ReactNode;
  renderCard: (row: T, index: number) => React.ReactNode;
  keyFor: (row: T) => string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    onPage: (offset: number) => void;
  };
}

export function DataView<T>({
  rows,
  isLoading,
  isRefreshing = false,
  error,
  onRetry,
  emptyTitle,
  emptyHint,
  head,
  renderRow,
  renderCard,
  keyFor,
  pagination,
}: DataViewProps<T>) {
  if (error) {
    return (
      <div className="rounded-admin border border-admin-border bg-admin-chrome p-10 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-3 h-11" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-admin border border-admin-border bg-admin-chrome p-4">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-admin border border-admin-border bg-admin-chrome p-12 text-center">
        <Inbox className="mx-auto h-9 w-9 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-semibold">{emptyTitle}</p>
        {emptyHint && (
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{emptyHint}</p>
        )}
      </div>
    );
  }

  const from = pagination ? pagination.offset + 1 : 1;
  const to = pagination ? pagination.offset + rows.length : rows.length;

  return (
    <div className={cn('space-y-3', isRefreshing && 'opacity-70 transition-opacity')}>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-admin border border-admin-border bg-admin-chrome lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">{head}</TableRow>
          </TableHeader>
          <TableBody>{rows.map((row, index) => renderRow(row, index))}</TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="stagger-children space-y-2 lg:hidden">
        {rows.map((row, index) => (
          <div
            key={keyFor(row)}
            className="rounded-admin border border-admin-border bg-admin-chrome p-3 shadow-sm"
          >
            {renderCard(row, index)}
          </div>
        ))}
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            {from}&ndash;{to} of {pagination.total}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              disabled={pagination.offset === 0 || isRefreshing}
              onClick={() =>
                pagination.onPage(Math.max(0, pagination.offset - pagination.limit))
              }
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              disabled={!pagination.hasMore || isRefreshing}
              onClick={() => pagination.onPage(pagination.offset + pagination.limit)}
              aria-label="Next page"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
