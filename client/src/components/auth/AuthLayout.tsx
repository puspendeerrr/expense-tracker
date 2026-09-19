import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Wallet } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <header className="flex justify-center items-center py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 text-slate-900 hover:opacity-90 transition-opacity"
        >
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-emerald-700/20">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-950 font-sans">
            SplitWise
          </span>
        </Link>
      </header>

      {/* Main Card Container */}
      <main className="w-full max-w-md mx-auto my-auto py-2">
        {children}
      </main>

      {/* Security & Legal Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Secure 256-bit encryption</span>
        </div>
        <p className="text-slate-400">
          © {new Date().getFullYear()} SplitWise. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

