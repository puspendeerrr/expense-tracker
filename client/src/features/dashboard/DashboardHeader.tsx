import React from 'react';
import {
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { BillingCycle, Group } from '@/types/domain';

/**
 * Dashboard header.
 *
 * Desktop and mobile are laid out separately rather than one being a squeezed version
 * of the other. Every action carries a text label -- a bare "+" icon is not a
 * discoverable way to offer the product's primary action.
 */

interface DashboardHeaderProps {
  groups: Group[];
  activeGroup: Group | null;
  billingCycle: BillingCycle | null;
  isConnected: boolean;
  isRefreshing: boolean;
  activeFilterCount: number;
  isExporting: boolean;
  onSwitchGroup: (groupId: string) => void;
  onAddExpense: () => void;
  onOpenFilters: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onManageGroups: () => void;
}

const LiveDot: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <span className="inline-flex items-center gap-1.5" title={isConnected ? 'Live' : 'Offline'}>
    <span
      aria-hidden
      className={cn(
        'h-1.5 w-1.5 rounded-full',
        isConnected ? 'bg-emerald-500 animate-pulse-subtle' : 'bg-slate-300',
      )}
    />
    <span className="text-xs font-medium text-slate-500">
      {isConnected ? 'Live' : 'Offline'}
    </span>
  </span>
);

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  groups,
  activeGroup,
  billingCycle,
  isConnected,
  isRefreshing,
  activeFilterCount,
  isExporting,
  onSwitchGroup,
  onAddExpense,
  onOpenFilters,
  onExport,
  onRefresh,
  onManageGroups,
}) => {
  const groupSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-h-[44px] max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate text-base font-bold text-slate-900 sm:text-lg">
            {activeGroup?.name ?? 'No group'}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>Your groups</DropdownMenuLabel>
        {groups.map((group) => (
          <DropdownMenuItem key={group.id} onSelect={() => onSwitchGroup(group.id)}>
            <span className="min-w-0 flex-1 truncate">{group.name}</span>
            {group.id === activeGroup?.id && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onManageGroups}>
          <Users className="h-4 w-4 text-slate-400" />
          Manage groups
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const paydayBadge = billingCycle?.payday ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      <CalendarClock className="h-3.5 w-3.5" />
      {billingCycle.daysRemaining === 0
        ? 'Payday today'
        : `Payday in ${billingCycle.daysRemaining}d`}
    </span>
  ) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {/* ---- Desktop ---- */}
      <div className="mx-auto hidden max-w-7xl items-center gap-4 px-6 py-3 lg:flex">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-lg font-black tracking-tight text-primary">SplitWise</span>
          <span aria-hidden className="h-5 w-px bg-slate-200" />
          <div className="min-w-0">{groupSwitcher}</div>
        </div>

        <div className="flex items-center gap-2">
          <LiveDot isConnected={isConnected} />
          {paydayBadge}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh dashboard"
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
          <Button variant="outline" onClick={onOpenFilters}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={onExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting ? 'Preparing…' : 'Export Excel'}
          </Button>
          <Button onClick={onAddExpense}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* ---- Mobile ---- */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 px-4 pt-2">
          <div className="min-w-0 flex-1">{groupSwitcher}</div>
          <LiveDot isConnected={isConnected} />
        </div>

        {paydayBadge && <div className="px-4 pb-1">{paydayBadge}</div>}

        {/* Labelled actions, never a bare icon for the primary action. */}
        <div className="flex items-center gap-2 px-4 pb-3 pt-1">
          <Button onClick={onAddExpense} className="flex-1">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Expense
          </Button>
          <Button variant="outline" onClick={onOpenFilters} className="px-3">
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onExport}
            disabled={isExporting}
            aria-label="Export to Excel"
            // Icon buttons default to 40px; on mobile that is under the touch target.
            className="h-11 w-11 shrink-0"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};
