import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
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
import { BrandLogo } from '@/components/brand/BrandLogo';

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
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-[#09090B]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl shadow-black/50'
          : 'bg-[#09090B]/75 backdrop-blur-lg border-b border-white/[0.05]',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-22 flex items-center justify-between">
        {/* Brand Logo - 44-48px mobile, 56-64px desktop */}
        <Link to="/" className="flex items-center gap-3 group select-none py-1">
          <BrandLogo
            variant="full"
            size="lg"
            className="h-11 sm:h-14 md:h-16 w-auto transition-transform duration-200 group-hover:scale-[1.02]"
            priority
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-[#111827]/70 p-1.5 rounded-2xl border border-white/[0.08] text-sm font-semibold text-slate-400 backdrop-blur-md">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollTo(link.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-emerald-400' : 'text-slate-400')} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop User Action Controls */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuthenticated && user ? (
            <Button asChild size="default" className="font-semibold h-10 px-5">
              <Link to="/app">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Go to App
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2.5">
              <Button asChild variant="ghost" className="font-semibold text-slate-300 hover:text-white h-10 px-4">
                <Link to="/login">
                  <LogIn className="mr-1.5 h-4 w-4 text-slate-400" />
                  Sign In
                </Link>
              </Button>
              <Button asChild size="default" className="font-semibold h-10 px-5">
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
            <Button asChild size="sm" className="h-9 px-3 text-xs font-semibold">
              <Link to="/app">App</Link>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-[#18181B] border border-white/[0.08] text-slate-200 hover:bg-[#1F2937] transition-colors outline-none focus:outline-none"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            <div className="w-5 h-4 flex flex-col justify-between items-center pointer-events-none">
              <span
                className={cn(
                  'h-0.5 w-5 bg-slate-300 rounded-full transition-all duration-300 ease-in-out transform origin-center',
                  mobileMenuOpen && 'rotate-45 translate-y-[7px] bg-emerald-400',
                )}
              />
              <span
                className={cn(
                  'h-0.5 w-5 bg-slate-300 rounded-full transition-all duration-200 ease-in-out',
                  mobileMenuOpen && 'opacity-0 scale-x-0',
                )}
              />
              <span
                className={cn(
                  'h-0.5 w-5 bg-slate-300 rounded-full transition-all duration-300 ease-in-out transform origin-center',
                  mobileMenuOpen && '-rotate-45 -translate-y-[7px] bg-emerald-400',
                )}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu Backdrop */}
      <div
        className={cn(
          'fixed inset-0 top-20 bg-black/60 backdrop-blur-md transition-opacity duration-300 z-40 sm:hidden',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Menu Floating Panel */}
      <div
        className={cn(
          'fixed inset-x-0 top-20 bg-[#09090B]/95 border-b border-white/[0.08] shadow-2xl z-50 sm:hidden transition-all duration-300 ease-out transform max-h-[calc(100vh-5rem)] overflow-y-auto backdrop-blur-2xl',
          mobileMenuOpen
            ? 'opacity-100 translate-y-0 visible pointer-events-auto'
            : 'opacity-0 -translate-y-3 invisible pointer-events-none',
        )}
      >
        <div className="px-4 pt-4 pb-6 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-3 block mb-1">
              Explore SplitMoney
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
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-slate-400',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-white/[0.08]">
            {isAuthenticated && user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#18181B] border border-white/[0.08]">
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                    {userInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.fullName}</p>
                    <p className="text-xs text-slate-400 font-mono truncate">{user.email}</p>
                  </div>
                  <Badge variant={user.role === 'admin' ? 'admin' : 'secondary'} className="text-[10px]">
                    {user.role}
                  </Badge>
                </div>

                <Button asChild className="w-full font-semibold h-11">
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
                <Button asChild className="w-full font-semibold h-11">
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
