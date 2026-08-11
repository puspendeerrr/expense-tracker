import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Wallet, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LandingNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'AI Assistant', href: '#ai-assistant' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto pointer-events-none">
      <div className="pointer-events-auto relative h-14 w-full px-5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 shadow-xl shadow-blue-500/5 flex items-center justify-between transition-all">
        {/* Minimal Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group focus:outline-none rounded-full">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <Wallet className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="font-sans font-bold text-base text-white tracking-tight">
            SplitWise
          </span>
        </Link>

        {/* Minimal Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors focus:outline-none"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Minimal Right Action */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="h-9 px-4 text-xs font-medium rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-95 focus:outline-none"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors px-3 py-1.5 focus:outline-none"
              >
                Sign In
              </Link>

              <Link
                to="/signup"
                className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1 hover:-translate-y-0.5 active:scale-95 focus:outline-none"
              >
                <span>Get Started</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-900 transition-colors focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto mt-2 rounded-2xl bg-slate-950/95 border border-slate-800/90 p-4 shadow-2xl backdrop-blur-2xl md:hidden flex flex-col gap-2.5"
          >
            {user && (
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300 flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span>Logged in as <strong className="text-white font-medium">{user.fullName || user.email}</strong></span>
              </div>
            )}

            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
              >
                {link.name}
              </a>
            ))}

            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
              {user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/dashboard');
                  }}
                  className="w-full h-10 rounded-xl bg-blue-600 text-white font-medium text-xs flex items-center justify-center gap-1.5"
                >
                  Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full h-9 rounded-xl bg-slate-900 text-slate-300 text-xs font-medium flex items-center justify-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full h-10 rounded-xl bg-blue-600 text-white text-xs font-medium flex items-center justify-center"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
