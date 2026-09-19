import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The filter band above every admin list.
 *
 * Desktop lays the controls out inline, because there is room and an operator wants to
 * see the whole query at once. A phone cannot show six controls and a table, so the
 * same controls move into a sheet behind one button, with the count of active filters
 * on the button so nothing is silently narrowing the list.
 *
 * Applied filters are echoed back as removable chips in both layouts. Without them a
 * filter set three screens deep becomes invisible, and the usual result is an operator
 * concluding that a record does not exist when it is merely filtered out.
 */

export interface ActiveFilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

interface AdminFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Names the list for screen-reader users, e.g. "users". */
  searchLabel: string;
  /** The filter controls themselves: selects, date inputs, amount ranges. */
  children?: React.ReactNode;
  chips?: ActiveFilterChip[];
  onReset?: () => void;
}

export const AdminFilterBar: React.FC<AdminFilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  children,
  chips = [],
  onReset,
}) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const searchBox = (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={`Search ${searchLabel}`}
        className="pl-9"
      />
      {search.length > 0 && (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {searchBox}

        {/* Desktop: controls inline. */}
        {children && (
          <div className="hidden flex-wrap items-center gap-2 lg:flex">{children}</div>
        )}

        {/* Mobile: the same controls behind one button. */}
        {children && (
          <Button
            variant="outline"
            className="h-11 shrink-0 lg:hidden"
            onClick={() => setIsSheetOpen(true)}
            aria-label={`Filters${chips.length > 0 ? `, ${chips.length} active` : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
            {chips.length > 0 && (
              <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                {chips.length}
              </span>
            )}
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-admin-border bg-admin-chrome py-1 pl-2.5 pr-1.5',
                'text-xs font-semibold transition-colors hover:border-destructive/50 hover:text-destructive',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label={`Remove filter: ${chip.label}`}
            >
              <span className="max-w-[180px] truncate">{chip.label}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
          {onReset && chips.length > 1 && (
            <button
              type="button"
              onClick={onReset}
              className="rounded px-2 py-1 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent variant="sheet" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {/* The same controlled elements as the desktop bar, stacked. They are
                passed in once by the caller, so the two layouts cannot describe
                different filters; only the visible one is mounted at a time. */}
            <div className="grid gap-3 [&_button[role=combobox]]:w-full [&>*]:w-full">
              {children}
            </div>
          </DialogBody>
          <DialogFooter>
            {onReset && (
              <Button
                variant="outline"
                onClick={() => {
                  onReset();
                  setIsSheetOpen(false);
                }}
              >
                Reset
              </Button>
            )}
            <Button onClick={() => setIsSheetOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
