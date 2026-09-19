import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Check,
  Copy,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Receipt,
  Settings,
  Shield,
  Users2,
  History,
  Activity,
  TrendingUp,
  X,
  UserCircle2,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupContext';
import { NotificationBell } from './NotificationBell';
import { InviteShare } from '@/features/groups/InviteShare';

/**
 * Application shell.
 *
 * Desktop gets a persistent left sidebar; mobile gets a slide-in drawer plus a bottom
 * tab bar for the four primary destinations. The bottom bar exists because reaching a
 * hamburger at the top of a tall phone is awkward for the things people do constantly.
 *
 * The topbar always carries notifications and the profile menu -- previously both were
 * missing from the authenticated area entirely.
 */

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  /** Shown in the mobile bottom bar as well as the sidebar. */
  primary?: boolean;
  /**
   * Hidden unless the account holds this capability. Hiding a link is a courtesy only:
   * the route and the API behind it enforce the same permission independently.
   */
  permission?: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true, primary: true },
  { to: '/app/expenses', label: 'Expenses', icon: Receipt, primary: true },
  { to: '/app/members', label: 'Members & Dues', icon: Users2, primary: true },
  { to: '/app/settlements', label: 'Settlement History', icon: History, primary: true },
  { to: '/app/activity', label: 'Activity', icon: Activity },
  {
    to: '/app/spending',
    label: 'Spending',
    icon: TrendingUp,
    permission: 'dashboard.spending',
  },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );

/** Active-group card: name, switcher, invite code and QR shortcut. */
const ActiveGroupCard: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { groups, activeGroup, setActiveGroupId } = useGroups();
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!activeGroup) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center">
        <p className="t-meta">No active group</p>
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
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="t-eyebrow">Active group</p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-1.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
              {activeGroup.name}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(18rem,calc(100vw-2rem))]">
          <DropdownMenuLabel>Switch group</DropdownMenuLabel>
          {groups.map((group) => (
            <DropdownMenuItem
              key={group.id}
              onSelect={() => {
                setActiveGroupId(group.id);
                onNavigate?.();
              }}
            >
              <span className="min-w-0 flex-1 truncate">{group.name}</span>
              {group.id === activeGroup.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              navigate('/app/groups');
              onNavigate?.();
            }}
          >
            <Users2 className="h-4 w-4 text-slate-400" />
            Manage groups
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={copyCode}
          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 font-mono text-xs font-bold tracking-widest text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Copy invite code ${activeGroup.inviteCode}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-400" />
          )}
          {activeGroup.inviteCode}
        </button>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex min-h-[40px] w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <NavLink to="/app/admin" className={navLinkClass} onClick={onNavigate}>
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
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <p className="truncate text-sm font-bold text-slate-900">{user?.fullName}</p>
          <p className="truncate t-meta">{user?.email}</p>
          {can('admin.access') && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/app/profile')}>
          <UserCircle2 className="h-4 w-4 text-slate-400" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/app/settings')}>
          <Settings className="h-4 w-4 text-slate-400" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void logout().then(() => navigate('/login'));
          }}
          className="text-destructive focus:bg-red-50"
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

  // Mount first, then flip the open flag on the next frame so the element starts
  // off-screen and animates in rather than appearing already open.
  const openDrawer = () => {
    setIsDrawerMounted(true);
    requestAnimationFrame(() => setDrawerOpen(true));
  };
  const primaryItems = NAV_ITEMS.filter((item) => item.primary);

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      {/* ---- Desktop sidebar ---- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
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
              'absolute inset-0 bg-slate-950/50 transition-opacity duration-200 ease-out',
              drawerOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-white shadow-2xl',
              'transition-transform duration-250 ease-out motion-reduce:transition-none',
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
                className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100"
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
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
            <button
              type="button"
              onClick={openDrawer}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {title && (
              <h1 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {title}
              </h1>
            )}

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>

        {toolbar && (
          <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:px-6">
              {toolbar}
            </div>
          </div>
        )}

        {/* Bottom padding clears the mobile tab bar and the home indicator. */}
        <main className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
      </div>

      {/* ---- Mobile bottom tab bar ---- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex">
          {primaryItems.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition-colors',
                    isActive ? 'text-primary' : 'text-slate-500',
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {/* Shortened labels: the full names do not fit four-up at 320px. */}
                <span className="max-w-full truncate">
                  {item.label === 'Settlement History'
                    ? 'History'
                    : item.label === 'Members & Dues'
                      ? 'Members'
                      : item.label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
