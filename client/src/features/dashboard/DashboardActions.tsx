import React from 'react';
import {
  Check,
  Download,
  LayoutGrid,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Users2,
  User,
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

/**
 * Dashboard toolbar.
 *
 * Seven controls fit on a desktop toolbar and do not fit on a phone. Rather than
 * shrinking everything until each is equally hard to hit, the two actions people
 * actually press on a phone -- add an expense, narrow the view -- stay on the bar, and
 * the settings-shaped controls move into a single menu.
 *
 * The switchers become checked menu items on mobile rather than segmented controls
 * squeezed into a drawer: inside a menu, a row with a tick is the shape people already
 * read as "this is the one that is on", and it gives each option a full-width target.
 *
 * Status (live connection, payday) is context rather than an action and is rendered in
 * the page body, so this holds only things you can press.
 */

interface DashboardActionsProps {
  isRefreshing: boolean;
  activeFilterCount: number;
  isExporting: boolean;
  onAddExpense: () => void;
  onOpenFilters: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onCustomise: () => void;
  mode: 'summary' | 'detailed';
  onModeChange: (mode: 'summary' | 'detailed') => void;
  view: 'group' | 'personal';
  onViewChange: (view: 'group' | 'personal') => void;
}

/** Two-option segmented control, sized for a thumb. Desktop only. */
const Segmented = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon: React.ComponentType<{ className?: string }> }[];
  onChange: (next: T) => void;
  label: string;
}) => (
  <div
    role="group"
    aria-label={label}
    className="flex h-11 shrink-0 items-center rounded-lg border border-border bg-card p-0.5"
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={value === option.value}
        title={option.label}
        className={cn(
          'flex h-full min-w-[40px] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          value === option.value
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <option.icon className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden xl:inline">{option.label}</span>
      </button>
    ))}
  </div>
);

/** A menu row that reports whether it is the option currently in effect. */
const CheckedItem: React.FC<{
  checked: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onSelect: () => void;
}> = ({ checked, icon: Icon, label, onSelect }) => (
  <DropdownMenuItem
    onSelect={onSelect}
    className={cn(checked && 'font-semibold text-primary')}
    aria-checked={checked}
    role="menuitemradio"
  >
    <Icon className="h-4 w-4 shrink-0" />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {checked && <Check className="h-4 w-4 shrink-0" />}
  </DropdownMenuItem>
);

export const DashboardActions: React.FC<DashboardActionsProps> = ({
  isRefreshing,
  activeFilterCount,
  isExporting,
  onAddExpense,
  onOpenFilters,
  onExport,
  onRefresh,
  onCustomise,
  mode,
  onModeChange,
  view,
  onViewChange,
}) => (
  <>
    {/*
      * One order everywhere: primary action, then Filters, then anything contextual.
      *
      * Add Expense leads at every width rather than sitting at the right on desktop, so
      * the control people press most is in the same place whichever device they are on
      * and the DOM order a keyboard follows matches what the eye sees.
      */}
    <Button onClick={onAddExpense} className="h-11 flex-1 sm:flex-none">
      <Plus className="mr-1.5 h-4 w-4" />
      Add Expense
    </Button>

    {/* Filters keeps a permanent place: its badge is the only signal that the figures
        on screen are narrowed, and that is not something to bury in a menu. */}
    <Button
      variant="outline"
      onClick={onOpenFilters}
      className="h-11 shrink-0 px-3"
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

    {/* ---- Mobile: everything else behind one button ---- */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-11 shrink-0 px-0 lg:hidden"
          aria-label="Dashboard options"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <CheckedItem
          checked={view === 'group'}
          icon={Users2}
          label="Whole group"
          onSelect={() => onViewChange('group')}
        />
        <CheckedItem
          checked={view === 'personal'}
          icon={User}
          label="Only what involves me"
          onSelect={() => onViewChange('personal')}
        />

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Detail</DropdownMenuLabel>
        <CheckedItem
          checked={mode === 'summary'}
          icon={LayoutGrid}
          label="Summary"
          onSelect={() => onModeChange('summary')}
        />
        <CheckedItem
          checked={mode === 'detailed'}
          icon={SlidersHorizontal}
          label="Detailed"
          onSelect={() => onModeChange('detailed')}
        />

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onCustomise}>
          <LayoutGrid className="h-4 w-4 shrink-0" />
          Widgets&hellip;
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onExport} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Download className="h-4 w-4 shrink-0" />
          )}
          {isExporting ? 'Preparing…' : 'Export to Excel'}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn('h-4 w-4 shrink-0', isRefreshing && 'animate-spin')} />
          Refresh
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* ---- Desktop: the same controls inline, pushed away from the primary pair ---- */}
    <div className="ml-auto hidden items-center gap-2 lg:flex">
      <Segmented
        label="Dashboard scope"
        value={view}
        onChange={onViewChange}
        options={[
          { value: 'group', label: 'Group', icon: Users2 },
          { value: 'personal', label: 'Personal', icon: User },
        ]}
      />

      <Segmented
        label="Level of detail"
        value={mode}
        onChange={onModeChange}
        options={[
          { value: 'summary', label: 'Summary', icon: LayoutGrid },
          { value: 'detailed', label: 'Detailed', icon: SlidersHorizontal },
        ]}
      />

      <Button
        variant="outline"
        onClick={onCustomise}
        aria-label="Customise the dashboard"
        className="h-11 w-11 px-0"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        onClick={onExport}
        disabled={isExporting}
        className="h-11 px-3"
        aria-label="Export to Excel"
      >
        {isExporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {isExporting ? 'Preparing…' : 'Export'}
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
    </div>
  </>
);
