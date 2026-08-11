import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LandingNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Who It\'s For', href: '#who-its-for' },
    { name: 'Settlement Engine', href: '#settlement-demo' },
    { name: 'Features', href: '#features' },
    { name: 'AI Assistant', href: '#ai-assistant' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <>
      {/* Top Banner for Logged-In Users */}
      {user && (
        <div className="bg-slate-900 text-white py-2 px-4 text-xs text-center font-medium flex items-center justify-center gap-2 border-b border-slate-800 relative z-50">
          <span>Logged in as <strong className="underline font-semibold text-emerald-400">{user.fullName || user.email}</strong></span>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all shadow-sm"
          >
            Go to Dashboard <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Permanently Fixed Ultra-Glassy Floating Pill Navbar */}
      <header className="fixed top-3.5 left-0 right-0 z-50 w-full px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto pointer-events-none">
        <div className="pointer-events-auto relative overflow-hidden h-[72px] sm:h-[76px] w-full px-4 sm:px-6 rounded-full bg-white/50 backdrop-blur-2xl backdrop-saturate-200 border border-white/70 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.9),0_12px_36px_-8px_rgba(15,23,42,0.12)] flex items-center justify-between transition-all">
          {/* Glass Specular Gloss Sheen Overlay */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/60 to-transparent pointer-events-none rounded-t-full" />

          {/* Brand Logo & Title (Using favicon.svg) */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full p-1 relative z-10">
            <img
              src="/favicon.svg"
              alt="Splitwise Logo"
              className="w-10 h-10 rounded-xl shadow-md group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="font-sans font-extrabold text-xl text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                Splitwise
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 font-mono font-bold uppercase tracking-wider border border-emerald-300/80 shadow-xs">
                  INDIA
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                A product by <span className="text-slate-900 font-semibold">Algorithyum</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 relative z-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="relative py-1 text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors group/link focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md"
              >
                {link.name}
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full scale-x-0 group-hover/link:scale-x-100 transition-transform duration-200" />
              </a>
            ))}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden sm:flex items-center gap-3 relative z-10">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="h-[44px] px-5 text-xs font-semibold rounded-full bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-md flex items-center gap-2 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Open Dashboard <ArrowRight className="w-4 h-4 text-emerald-400" />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors px-3 py-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Sign In
                </Link>

                {/* Primary Create Group CTA Button */}
                <Link
                  to="/signup"
                  className="h-[44px] px-5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[15px] transition-all shadow-md shadow-slate-900/10 flex items-center justify-center gap-1.5 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span>Create Group</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-full bg-white/70 border border-white/80 text-slate-800 backdrop-blur-md hover:bg-white/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 relative z-10"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto lg:hidden mt-2 bg-white/80 backdrop-blur-2xl backdrop-saturate-200 border border-white/80 rounded-3xl p-5 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
            >
              <div className="flex flex-col space-y-2">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:text-emerald-700 hover:bg-white/60 rounded-2xl transition-colors"
                  >
                    {link.name}
                  </a>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex flex-col gap-3">
                {user ? (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/dashboard');
                    }}
                    className="w-full h-[46px] text-center text-sm font-semibold rounded-full bg-slate-900 text-white shadow-md flex items-center justify-center gap-2"
                  >
                    Open Dashboard <ArrowRight className="w-4 h-4 text-emerald-400" />
                  </button>
                ) : (
                  <>
                    <Link
                      to="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full h-[46px] text-center text-sm font-semibold rounded-full bg-slate-900 text-white shadow-md flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                      <span>Create Group</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full h-11 text-center text-sm font-semibold rounded-full border border-slate-300/80 bg-white/60 text-slate-800 hover:bg-white/90 flex items-center justify-center"
                    >
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
};
