import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300">
      {/* Pre-Footer Call to Action Banner */}
      <div className="border-b border-slate-800 py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
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
              className="w-full sm:w-auto bg-primary hover:bg-emerald-600 text-white font-semibold text-base px-8 h-12 shadow-lg shadow-emerald-900/40"
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
              className="w-full sm:w-auto border-slate-700 bg-slate-800/60 text-white hover:bg-slate-800 font-semibold text-base px-8 h-12"
            >
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Information */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800 text-center md:text-left">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shadow-emerald-700/30">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white font-sans">
              SplitWise
            </span>
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
            <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <span>Safe, secure & encrypted</span>
          </div>

          <p>
            © {new Date().getFullYear()} SplitWise. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
