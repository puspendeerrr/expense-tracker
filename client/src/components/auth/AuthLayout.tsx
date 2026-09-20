import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/[0.07] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)] pointer-events-none" />

      {/* Brand Header */}
      <header className="flex justify-center items-center pt-8 pb-6 sm:pt-10 sm:pb-8 relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 text-foreground hover:opacity-95 transition-opacity"
        >
          <BrandLogo
            variant="full"
            size="2xl"
            className="h-20 sm:h-22 md:h-24 w-auto drop-shadow-2xl hover:scale-[1.02] transition-transform duration-200"
            priority
          />
        </Link>
      </header>

      {/* Main Card Container */}
      <main className="w-full max-w-md mx-auto my-auto py-2 relative z-10">
        {children}
      </main>

      {/* Security & Legal Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2 relative z-10">
        <div className="inline-flex items-center gap-1.5 text-slate-400 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Secure 256-bit encryption</span>
        </div>
        <p className="text-slate-500">
          © {new Date().getFullYear()} SplitMoney. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

