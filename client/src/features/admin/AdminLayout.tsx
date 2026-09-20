import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Receipt,
  Search,
  Shield,
  ShieldCheck,
  Users2,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdminSearch } from './AdminSearch';

/**
 * Admin console shell.
 *
 * This is deliberately not the consumer AppShell with different links in it. An
 * operator is doing a different job -- monitoring and intervening, rather than logging
 * a dinner -- so the chrome is cooler, denser and grouped by that job: what you watch,
 * what you manage, what governs the platform. Destinations are grouped rather than
 * listed flat, because a flat list of nine is a menu you scan every time instead of a
 * structure you learn once.
 *
 * Desktop gets a persistent tinted sidebar; a phone gets a compact header with a
 * slide-in drawer plus a bottom bar for the few destinations worth one tap. All three
 * render from ADMIN_NAV, so there is one definition of the navigation rather than
 * three that drift apart.
 *
 * Built entirely on semantic tokens, so it follows the light/dark preference the whole
 * product now shares.
 */

type AdminNavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  /** Shown in the mobile bottom bar as well as the sidebar. */
  primary?: boolean;
};

type AdminNavSection = {
  /** What this group of screens is for, in one word. */
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: 'Monitor',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, primary: true },
      { to: '/admin/activity', label: 'Activity', icon: Activity, primary: true },
      { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users2, primary: true },
      { to: '/admin/groups', label: 'Groups', icon: Shield, primary: true },
      { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
      { to: '/admin/settlements', label: 'Settlements', icon: Wallet },
    ],
  },
  {
    label: 'Govern',
    items: [
      { to: '/admin/permissions', label: 'Permissions', icon: ShieldCheck },
      { to: '/admin/audit', label: 'Audit log', icon: ClipboardList },
    ],
  },
];

/** Flat view of the same definition, for anything that needs a plain list. */
export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap(
  (section) => section.items,
);

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'relative flex min-h-[44px] items-center gap-2.5 rounded-admin px-3 text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? // A left rule rather than a filled pill: it marks position without turning a
        // navigation item into something that looks pressable.
        'bg-primary/10 text-primary before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-primary'
      : 'text-admin-nav-foreground hover:bg-accent hover:text-foreground',
  );

/** Console wordmark, shared by the sidebar and the drawer. */
const AdminBrand: React.FC = () => (
  <div className="flex min-w-0 items-center gap-2.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-admin bg-primary/10">
      <Shield className="h-4 w-4 text-primary" />
    </span>
    <span className="min-w-0">
      <span className="block truncate text-sm font-bold leading-tight">SplitMoney</span>
      <span className="block truncate text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Platform control
      </span>
    </span>
  </div>
);

const NavList: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
  <nav aria-label="Admin sections" className="space-y-5">
    {ADMIN_NAV_SECTIONS.map((section) => (
      <div key={section.label}>
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
          {section.label}
        </p>
        <ul className="space-y-0.5">
          {section.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={navLinkClass}
                onClick={onNavigate}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </nav>
);

interface AdminLayoutProps {
  /** Used for the mobile header and the document context; the body renders its own
   *  AdminPageHeader, which carries the breadcrumbs and description. */
  title: string;
  /** Page-level filters, rendered in their own sticky band rather than in the header. */
  toolbar?: React.ReactNode;
  /** Renders a back arrow to this route; used by the detail screens. */
  backTo?: string;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  title,
  toolbar,
  backTo,
  children,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Mount first, then animate on the next frame, so the transition actually runs
  // instead of the drawer appearing already in place.
  const openDrawer = () => {
    setIsDrawerMounted(true);
    requestAnimationFrame(() => setIsDrawerOpen(true));
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    window.setTimeout(() => setIsDrawerMounted(false), 200);
  };

  // A route change should never leave the drawer covering the page behind it.
  useEffect(() => {
    setIsDrawerOpen(false);
    setIsDrawerMounted(false);
  }, [location.pathname]);

  // Cmd/Ctrl-K is the search shortcut operators already expect from other consoles.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const primary = ADMIN_NAV.filter((item) => item.primary);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-admin-canvas text-foreground">
        {/* ---- Desktop sidebar ---- */}
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-admin-border bg-admin-nav lg:flex">
          <div className="flex h-14 items-center border-b border-admin-border px-4">
            <AdminBrand />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <NavList />
          </div>
          <div className="border-t border-admin-border p-3">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => navigate('/app')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to SplitMoney
            </Button>
          </div>
        </aside>

        {/* ---- Mobile drawer ---- */}
        {isDrawerMounted && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeDrawer}
              className={cn(
                'absolute inset-0 bg-slate-950/60 transition-opacity duration-200',
                isDrawerOpen ? 'opacity-100' : 'opacity-0',
              )}
            />
            <div
              className={cn(
                'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-admin-nav shadow-xl',
                'transition-transform duration-200 ease-out',
                isDrawerOpen ? 'translate-x-0' : '-translate-x-full',
              )}
            >
              <div className="flex h-14 items-center justify-between gap-2 border-b border-admin-border px-4">
                <AdminBrand />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  aria-label="Close menu"
                  onClick={closeDrawer}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <NavList onNavigate={closeDrawer} />
              </div>
              <div className="border-t border-admin-border p-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => navigate('/app')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to SplitMoney
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="lg:pl-60">
          {/* ---- Header ---- */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-admin-border bg-admin-chrome/95 px-3 backdrop-blur sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 lg:hidden"
              aria-label="Open menu"
              onClick={openDrawer}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {backTo && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label="Go back"
                onClick={() => navigate(backTo)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}

            {/* The body renders the real page header. On a phone there is no sidebar to
                say where you are, so the title is repeated here and nowhere else. */}
            <span className="min-w-0 flex-1 truncate text-sm font-bold lg:hidden">
              {title}
            </span>

            {/* Desktop: a full-width search affordance rather than a lone icon, so the
                shortcut is discoverable instead of folklore. */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="ml-1 hidden h-9 min-w-0 flex-1 max-w-sm items-center gap-2 rounded-admin border border-admin-border bg-admin-canvas px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Search the platform</span>
              <kbd className="shrink-0 rounded border border-admin-border bg-admin-chrome px-1.5 font-mono text-[10px] font-semibold">
                ⌘K
              </kbd>
            </button>

            <div className="flex-1 lg:hidden" />

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 lg:hidden"
              aria-label="Search the platform"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>

            <ThemeToggle />

            <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:block">
              {user?.email}
            </span>
          </header>

          {toolbar && (
            <div className="sticky top-14 z-20 border-b border-admin-border bg-admin-canvas/95 px-3 py-2 backdrop-blur sm:px-4">
              {toolbar}
            </div>
          )}

          <main className="px-3 pb-24 pt-4 sm:px-4 lg:px-6 lg:pb-10">{children}</main>
        </div>

        {/* ---- Mobile bottom bar ---- */}
        <nav
          aria-label="Admin quick navigation"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-admin-border bg-admin-chrome lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate px-1">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <AdminSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      </div>
    </TooltipProvider>
  );
};
