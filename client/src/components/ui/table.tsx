import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Table primitives for the admin console.
 *
 * Written against semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`)
 * rather than literal colours, so the whole console follows the theme without a second
 * set of dark-mode classes.
 *
 * These are for desktop only. On a phone the admin screens render the same rows as
 * cards instead -- a horizontally scrolling table is not a mobile experience, it is a
 * desktop one you have to drag.
 */

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 px-3 text-left align-middle text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-3 py-2.5 align-middle', className)} {...props} />
));
TableCell.displayName = 'TableCell';

/**
 * Sortable column header.
 *
 * The whole header is the button and it states the next action through `aria-label`,
 * because an arrow glyph alone does not tell a screen-reader user what activating it
 * will do.
 */
export const SortableHead: React.FC<{
  label: string;
  column: string;
  activeColumn: string | null;
  direction: 'asc' | 'desc';
  onSort: (column: string) => void;
  className?: string;
}> = ({ label, column, activeColumn, direction, onSort, className }) => {
  const isActive = activeColumn === column;
  const next = isActive && direction === 'asc' ? 'descending' : 'ascending';

  return (
    <TableHead className={cn('p-0', className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}, ${next}`}
        aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'flex h-11 w-full items-center gap-1.5 px-3 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive ? 'text-foreground' : 'hover:text-foreground',
        )}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.06em]">{label}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3 w-3 shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        )}
      </button>
    </TableHead>
  );
};
