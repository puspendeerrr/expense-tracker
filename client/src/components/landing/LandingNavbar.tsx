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
    { name: 'Features', href: '/#features' },
    { name: 'Founder Note', href: '/founder' },
    { name: 'Engineering', href: '/developer' },
  ];

  return (
    <header className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-8 lg:px-12 xl:px-16 max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1600px] mx-auto pointer-events-none">
      <div className="pointer-events-auto relative h-14 w-full px-6 sm:px-8 rounded-full bg-white/90 backdrop-blur-md border border-[#FF6B00]/15 shadow-lg shadow-[#FF6B00]/5 flex items-center justify-between transition-all">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group focus:outline-none rounded-full shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C42] flex items-center justify-center text-white shadow-md shadow-[#FF6B00]/30 group-hover:scale-105 transition-transform">
            <Wallet className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="font-sans font-bold text-base text-[#1E1E1E] tracking-tight">
            SplitWise <span className="text-[#FF6B00] text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/20">Pro</span>
          </span>
        </Link>

        {/* Minimal Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) =>
            link.href.startsWith('/founder') || link.href.startsWith('/developer') ? (
              <Link
                key={link.name}
                to={link.href}
                className="text-xs font-semibold text-[#1E1E1E]/70 hover:text-[#FF6B00] transition-colors focus:outline-none"
              >
                {link.name}
              </Link>
            ) : (
              <a
                key={link.name}
                href={link.href}
                className="text-xs font-semibold text-[#1E1E1E]/70 hover:text-[#FF6B00] transition-colors focus:outline-none"
              >
                {link.name}
              </a>
            )
          )}
        </nav>

        {/* Desktop CTA Action */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="h-9.5 px-4 text-xs font-semibold rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] hover:opacity-95 text-white transition-all shadow-md shadow-[#FF6B00]/25 flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:-translate-y-0.5 active:scale-95 focus:outline-none"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs font-semibold text-[#1E1E1E]/80 hover:text-[#FF6B00] transition-colors px-3 py-1.5 focus:outline-none whitespace-nowrap"
              >
                Sign In
              </Link>

              <Link
                to="/signup"
                className="h-9.5 px-5 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] hover:opacity-95 text-white font-bold text-xs transition-all shadow-md shadow-[#FF6B00]/25 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 hover:-translate-y-0.5 active:scale-95 focus:outline-none"
              >
                <span>Get Started</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 rounded-full text-[#1E1E1E]/80 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto mt-2 rounded-2xl bg-white/95 border border-[#FF6B00]/20 p-4 shadow-2xl backdrop-blur-xl md:hidden flex flex-col gap-2.5"
          >
            {user && (
              <div className="p-2.5 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-xs text-[#1E1E1E] flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-[#FF6B00] flex-shrink-0" />
                <span>Logged in as <strong className="font-semibold">{user.fullName || user.email}</strong></span>
              </div>
            )}

            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-[#1E1E1E]/80 hover:text-[#FF6B00] hover:bg-[#FFF8F2] rounded-xl transition-colors"
              >
                {link.name}
              </a>
            ))}

            <div className="pt-2 border-t border-[#FF6B00]/10 flex flex-col gap-2">
              {user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/dashboard');
                  }}
                  className="w-full h-10 rounded-xl bg-[#FF6B00] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#FF6B00]/20"
                >
                  Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full h-9 rounded-xl bg-white text-[#1E1E1E] text-xs font-semibold flex items-center justify-center border border-slate-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full h-10 rounded-xl bg-[#FF6B00] text-white text-xs font-semibold flex items-center justify-center shadow-md shadow-[#FF6B00]/20"
                  >
                    Get Started Free
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
