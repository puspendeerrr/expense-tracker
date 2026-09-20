import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand/BrandLogo';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-[#09090B] text-slate-400 border-t border-white/[0.08] relative overflow-hidden">
      {/* Pre-Footer Call to Action Banner */}
      <div className="border-b border-white/[0.08] py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/[0.08] blur-[120px] pointer-events-none -z-10" />
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>Get Started in 60 Seconds</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight font-sans">
            Ready to simplify shared finances?
          </h2>

          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto font-normal">
            Join flatmates and groups who track shared expenses without spreadsheets, rounding drift, or awkward money conversations.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto font-semibold text-base px-8 h-12 shadow-lg shadow-emerald-950/40"
            >
              <Link to="/signup">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto font-semibold text-base px-8 h-12"
            >
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Information */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/[0.08] text-center md:text-left">
          <div className="flex items-center gap-2.5">
            <BrandLogo
              variant="full"
              size="lg"
              className="h-12 sm:h-14 w-auto opacity-95 hover:opacity-100 transition-opacity"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#settlement" className="hover:text-white transition-colors">Settlements</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-white transition-colors">Register</Link>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
          <div className="flex items-center gap-1.5 justify-center">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span className="text-slate-400">Safe, secure &amp; 256-bit encrypted</span>
          </div>

          <p>
            © {new Date().getFullYear()} SplitMoney. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
