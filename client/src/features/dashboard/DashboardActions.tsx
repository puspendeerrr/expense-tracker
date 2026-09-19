import React from 'react';
import { Download, Loader2, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Dashboard toolbar.
 *
 * Lives in the page's own toolbar band, not the topbar. Status (live connection,
 * payday) is context rather than an action and is rendered inside the page body, so
 * this holds only things you can press.
 */

interface DashboardActionsProps {
  isRefreshing: boolean;
  activeFilterCount: number;
  isExporting: boolean;
  onAddExpense: () => void;
  onOpenFilters: () => void;
  onExport: () => void;
  onRefresh: () => void;
}

export const DashboardActions: React.FC<DashboardActionsProps> = ({
  isRefreshing,
  activeFilterCount,
  isExporting,
  onAddExpense,
  onOpenFilters,
  onExport,
  onRefresh,
}) => (
  <>
    {/* The label is hidden on phones, so an explicit name is required or the button
        is announced as unlabelled. */}
    <Button
      variant="outline"
      onClick={onOpenFilters}
      className="h-11 px-3"
      aria-label="Filters"
    >
      <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline" aria-hidden>
        Filters
      </span>
      {activeFilterCount > 0 && (
        <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
          {activeFilterCount}
        </span>
      )}
    </Button>

    <Button
      variant="outline"
      onClick={onExport}
      disabled={isExporting}
      className="h-11 w-11 px-0 sm:w-auto sm:px-3"
      aria-label="Export to Excel"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
      ) : (
        <Download className="h-4 w-4 sm:mr-2" />
      )}
      <span className="hidden sm:inline" aria-hidden>
        {isExporting ? 'Preparing…' : 'Export'}
      </span>
    </Button>

    <Button
      variant="outline"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label="Refresh dashboard"
      className="h-11 w-11 px-0"
    >
      <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
    </Button>

    {/* Fills the remaining width on a phone; sized to content on larger screens. */}
    <Button onClick={onAddExpense} className="h-11 flex-1 sm:ml-auto sm:flex-none">
      <Plus className="mr-1.5 h-4 w-4" />
      Add Expense
    </Button>
  </>
);
