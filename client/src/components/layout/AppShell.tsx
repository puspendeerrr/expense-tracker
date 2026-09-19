import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronDown,
  Check,
  Copy,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Receipt,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users2,
  History,
  Activity,
  TrendingUp,
  X,
  UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupContext';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommandPalette } from '@/components/CommandPalette';
import { initialsOf } from '@/lib/names';
import { InviteShare } from '@/features/groups/InviteShare';
import { GroupAvatar } from '@/features/groups/GroupAvatar';

/**
 * Application shell.
 *
 * Desktop gets a persistent left sidebar; mobile gets a slide-in drawer reached from
 * the topbar. There is deliberately no bottom tab bar: it permanently occupied a strip
 * of the shortest dimension on the smallest screens, duplicated four links the drawer
 * already carried, and left every page owing it bottom padding.
 *
 * The topbar always carries notifications, theme and the profile menu.
 */


type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  /**
   * Hidden unless the account holds this capability. Hiding a link is a courtesy only:
   * the route and the API behind it enforce the same permission independently.
   */
  permission?: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/expenses', label: 'Expenses', icon: Receipt },
  { to: '/app/members', label: 'Members & Dues', icon: Users2 },
  { to: '/app/settlements', label: 'Settlement History', icon: History },
  { to: '/app/activity', label: 'Activity', icon: Activity },
  {
    to: '/app/spending',
    label: 'Spending',
    icon: TrendingUp,
    permission: 'dashboard.spending',
  },
  { to: '/app/security', label: 'Security', icon: ShieldCheck },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'group relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-semibold',
    'transition-[color,background-color,transform] duration-150 active:scale-[0.99]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    // A rule pinned to the left edge marks the current section without making the whole
    // row look like a pressed button, and it grows from nothing rather than appearing.
    'before:absolute before:inset-y-2 before:-left-2 before:w-[3px] before:rounded-r-full',
    'before:bg-primary before:transition-transform before:duration-200 before:ease-sheet',
    'before:origin-center',
    isActive
      ? 'bg-primary/10 text-primary before:scale-y-100'
      : 'text-muted-foreground before:scale-y-0 hover:bg-accent hover:text-foreground',
  );

/** Active-group card: name, switcher, invite code and QR shortcut. */
const ActiveGroupCard: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { groups, activeGroup, status, setActiveGroupId } = useGroups();
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  /*
   * Membership not resolved yet.
   *
   * This card is the one that produced the post-login flash. `!activeGroup` is true
   * both while the membership request is in flight and when someone genuinely belongs
   * to nothing, and rendering the same "Create a group" prompt for both told every
   * returning user they had no groups for as long as the request took.
   *
   * A skeleton of the same height is the honest answer to "we do not know yet", and it
   * keeps the sidebar from reflowing when the real card arrives.
   */
  if (status === 'loading') {
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="mt-2 h-4 w-32" />
        <div className="mt-2 flex gap-1.5">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-11 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div className="rounded-xl border border-dashed border-input p-3 text-center">
        <p className="t-meta">
          {status === 'error' ? 'Could not load groups' : 'No active group'}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => {
            navigate('/app/groups/new');
            onNavigate?.();
          }}
        >
          Create a group
        </Button>
      </div>
    );
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeGroup.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the code is visible on the button regardless.
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* The cover doubles as the card's header, so a group with one is recognisable
          from the sidebar without costing any extra vertical space. */}
      {activeGroup.coverUrl && (
        <div className="h-12 w-full">
          <img
            src={activeGroup.coverUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-3">
      <p className="t-eyebrow">Active group</p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/*
            * Previously bare text with a chevron, which gave no indication it could be
            * pressed. It now has a hover surface, a press response, and a chevron that
            * turns while the menu is open so the control and the menu read as one thing.
            */}
          <button
            type="button"
            className={cn(
              'group mt-1 -mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-1.5 rounded-lg px-1.5 py-1 text-left',
              'transition-[background-color,transform] duration-150 active:scale-[0.99]',
              'hover:bg-accent data-[state=open]:bg-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <GroupAvatar
              name={activeGroup.name}
              url={activeGroup.avatarUrl}
              className="h-6 w-6 shrink-0 text-[10px]"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
              {activeGroup.name}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-sheet',
                'group-data-[state=open]:rotate-180',
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          // Matches the control it opens from, the way a select does. A wider menu
          // spills out of the fixed sidebar and over the page behind it.
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[13rem]"
        >
          <DropdownMenuLabel>Switch group</DropdownMenuLabel>
          {groups.map((group) => {
            const isCurrent = group.id === activeGroup.id;
            return (
              <DropdownMenuItem
                key={group.id}
                onSelect={() => {
                  // Re-selecting the current group would refetch every region for no
                  // change; close instead.
                  if (isCurrent) return;
                  setActiveGroupId(group.id);
                  toast.success(`Switched to ${group.name}`);
                  onNavigate?.();
                }}
                className={cn(isCurrent && 'font-semibold text-primary')}
              >
                <GroupAvatar
                  name={group.name}
                  url={group.avatarUrl}
                  className={cn(
                    'h-6 w-6 shrink-0 text-[10px]',
                    isCurrent && 'ring-1 ring-primary/40',
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                {isCurrent && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              navigate('/app/groups');
              onNavigate?.();
            }}
          >
            <Users2 className="h-4 w-4 text-muted-foreground" />
            Manage groups
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={copyCode}
          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 font-mono text-xs font-bold tracking-widest text-foreground/80 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Copy invite code ${activeGroup.inviteCode}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {activeGroup.inviteCode}
        </button>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex min-h-[40px] w-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Show invite QR code"
        >
          <QrCode className="h-4 w-4" />
        </button>
      </div>

      <InviteShare
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        groupId={activeGroup.id}
      />
      </div>
    </div>
  );
};

const SidebarContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { can } = useAuth();
  const canOpenAdmin = can('admin.access');
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <ActiveGroupCard onNavigate={onNavigate} />

      <nav aria-label="Main">
        <p className="t-eyebrow mb-1 px-3">Menu</p>
        <ul className="space-y-0.5">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={navLinkClass} onClick={onNavigate}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {canOpenAdmin && (
        <nav aria-label="Administration">
          <p className="t-eyebrow mb-1 px-3">Administration</p>
          <NavLink to="/admin" className={navLinkClass} onClick={onNavigate}>
            <Shield className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Admin console</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
};

/** Profile menu. */
const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, can } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <Avatar className="h-9 w-9">
            {user?.qrCodeUrl ? <AvatarImage src={user.qrCodeUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initialsOf(user?.fullName ?? '')}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-bold text-foreground">{user?.fullName}</p>
          <p className="truncate t-meta">{user?.email}</p>
          {can('admin.access') && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/app/profile')}>
          <UserCircle2 className="h-4 w-4 text-muted-foreground" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/app/settings')}>
          <Settings className="h-4 w-4 text-muted-foreground" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void logout().then(() => navigate('/login'));
          }}
          className="text-destructive focus:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface AppShellProps {
  /**
   * Page-owned toolbar rendered directly beneath the header: filters, export, primary
   * action. Kept out of the topbar so the bar shows only identity and never competes
   * for space with page controls.
   */
  toolbar?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ toolbar, title, children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  /*
   * Ctrl/Cmd-K opens the palette, and "/" does too when the focus is not already in a
   * field -- the shortcut people reach for in a search-first product. Guarding on the
   * focused element matters: without it, typing a slash into an expense title would
   * open the palette instead.
   */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mount first, then flip the open flag on the next frame so the element starts
  // off-screen and animates in rather than appearing already open.
  const openDrawer = () => {
    setIsDrawerMounted(true);
    requestAnimationFrame(() => setDrawerOpen(true));
  };
  return (
    <div className="min-h-[100dvh] bg-muted">
      {/* ---- Desktop sidebar ---- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-card lg:block">
        <div className="flex h-14 items-center px-4">
          <span className="text-lg font-extrabold tracking-tight text-primary">
            {env.appName}
          </span>
        </div>
        <SidebarContent />
      </aside>

      {/* ---- Mobile drawer ----
       *
       * Kept mounted while closing so the slide-out can actually play; `isDrawerMounted`
       * is cleared by the transition's end rather than immediately on close.
       */}
      {isDrawerMounted && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className={cn(
              'absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]',
              'transition-opacity duration-280 ease-sheet',
              'motion-reduce:transition-none',
              drawerOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-card shadow-2xl',
              // `duration-250` is not a Tailwind step, so the class was never generated
              // and the panel fell back to the 150ms that `transition-transform` sets --
              // fast enough to read as a snap. The curve below decelerates hard at the
              // end, which is what makes a panel feel like it settles rather than stops.
              'transition-transform duration-280 ease-sheet',
              'will-change-transform motion-reduce:transition-none',
              drawerOpen ? 'translate-x-0' : '-translate-x-full',
            )}
            onTransitionEnd={() => {
              if (!drawerOpen) setIsDrawerMounted(false);
            }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between px-4">
              <span className="text-lg font-extrabold tracking-tight text-primary">
                {env.appName}
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* ---- Topbar ---- */}
        {/*
         * Topbar carries identity only: where you are, your notifications, your
         * account. Page actions (filters, export, add, refresh) belong to the page
         * that owns them and are rendered in its own toolbar, so the bar stays the
         * same everywhere and never runs out of room on a phone.
         */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
            <button
              type="button"
              onClick={openDrawer}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {title && (
              <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
                {title}
              </h1>
            )}

            {/* A visible affordance, so the shortcut is discoverable rather than folklore. */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-4 hidden h-9 min-w-0 max-w-xs flex-1 items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Search</span>
              <kbd className="shrink-0 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-semibold">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent lg:hidden"
              >
                <Search className="h-5 w-5" />
              </button>
              <ThemeToggle />
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>

        {toolbar && (
          <div className="sticky top-14 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:px-6">
              {toolbar}
            </div>
          </div>
        )}

        {/*
          * Keyed by pathname so the entrance animation replays on every navigation.
          *
          * The key is the path alone, not the whole location: query-string changes are
          * filter edits, and remounting the page under someone adjusting a filter would
          * throw away their scroll position mid-interaction.
          */}
        <main
          key={location.pathname}
          className="animate-fade-in-up pb-[env(safe-area-inset-bottom)]"
        >
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
};
