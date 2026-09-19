import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowRight,
  Sparkles,
  Layers,
  QrCode,
  ShieldCheck,
  HelpCircle,
  LogIn,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const LandingNavbar: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  // Track scroll position for subtle shadow and background transition
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = ['features', 'how-it-works', 'settlement', 'security', 'faq'];
      const current = sections.find((section) => {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          return rect.top <= 120 && rect.bottom >= 120;
        }
        return false;
      });
      if (current) setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent background scroll when mobile menu is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navLinks = [
    { id: 'features', label: 'Features', icon: Sparkles },
    { id: 'how-it-works', label: 'How It Works', icon: Layers },
    { id: 'settlement', label: 'Settlements', icon: QrCode },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
  ];

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200',
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/90'
          : 'bg-white/80 backdrop-blur-md border-b border-slate-200/60',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Tagline */}
        <Link to="/" className="flex items-center gap-3 group select-none">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-800 to-primary flex items-center justify-center text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 group-hover:shadow-emerald-700/30 transition-all duration-200">
            <Wallet className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-slate-950 font-sans">
                SplitWise
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-700 -mt-1">
              Shared Expense Ledger
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200/60 text-sm font-semibold text-slate-600">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollTo(link.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150',
                  isActive
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/60',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-emerald-600' : 'text-slate-400')} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop User Action Controls (Landing page - no notifications bell) */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuthenticated && user ? (
            <Button asChild className="font-semibold shadow-sm shadow-emerald-700/20 h-10 px-5 bg-primary hover:bg-emerald-700">
              <Link to="/app">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Go to App
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2.5">
              <Button asChild variant="ghost" className="font-semibold text-slate-700 hover:text-slate-950 h-10 px-4">
                <Link to="/login">
                  <LogIn className="mr-1.5 h-4 w-4 text-slate-400" />
                  Sign In
                </Link>
              </Button>
              <Button asChild className="font-semibold shadow-sm shadow-emerald-700/20 h-10 px-5 bg-primary hover:bg-emerald-700">
                <Link to="/signup">
                  Open Account
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Controls */}
        <div className="flex sm:hidden items-center gap-2">
          {isAuthenticated && user && (
            <Button asChild size="sm" className="h-9 px-3 text-xs font-semibold bg-primary hover:bg-emerald-700">
              <Link to="/app">App</Link>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100/80 hover:bg-slate-200/80 transition-colors outline-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            <div className="w-5 h-4 flex flex-col justify-between items-center pointer-events-none">
              <span
                className={cn(
                  'h-0.5 w-5 bg-slate-700 rounded-full transition-all duration-300 ease-in-out transform origin-center',
                  mobileMenuOpen && 'rotate-45 translate-y-[7px] bg-slate-900',
                )}
              />
              <span
                className={cn(
                  'h-0.5 w-5 bg-slate-700 rounded-full transition-all duration-200 ease-in-out',
                  mobileMenuOpen && 'opacity-0 scale-x-0',
                )}
              />
              <span
                className={cn(
                  'h-0.5 w-5 bg-slate-700 rounded-full transition-all duration-300 ease-in-out transform origin-center',
                  mobileMenuOpen && '-rotate-45 -translate-y-[7px] bg-slate-900',
                )}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu Backdrop (Floats over the screen without pushing it down) */}
      <div
        className={cn(
          'fixed inset-0 top-20 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 z-40 sm:hidden',
          mobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Menu Floating Panel (Over the screen) */}
      <div
        className={cn(
          'fixed inset-x-0 top-20 bg-white border-b border-slate-200 shadow-2xl z-50 sm:hidden transition-all duration-300 ease-out transform max-h-[calc(100vh-5rem)] overflow-y-auto',
          mobileMenuOpen
            ? 'opacity-100 translate-y-0 visible pointer-events-auto'
            : 'opacity-0 -translate-y-3 invisible pointer-events-none',
        )}
      >
        <div className="px-4 pt-3 pb-6 space-y-4">
          {/* Navigation Links with Icons */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 block mb-1">
              Explore SplitWise
            </span>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => scrollTo(link.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left',
                    isActive
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950',
                  )}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                      isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          {/* User Account State in Mobile Menu (Landing page - no notification bell) */}
          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated && user ? (
              <div className="space-y-3">
                {/* User Card */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="h-10 w-10 rounded-full bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                    {userInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{user.fullName}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
                  </div>
                  <Badge variant={user.role === 'admin' ? 'admin' : 'secondary'} className="text-[10px]">
                    {user.role}
                  </Badge>
                </div>

                <Button asChild className="w-full font-semibold h-11 bg-primary hover:bg-emerald-700">
                  <Link to="/app" onClick={() => setMobileMenuOpen(false)}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Go to App
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full font-semibold h-11">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
                <Button asChild className="w-full font-semibold h-11 bg-primary hover:bg-emerald-700">
                  <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                    Get Started Free
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
