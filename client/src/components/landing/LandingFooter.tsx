import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Heart, Github, Linkedin } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-white text-slate-600 border-t border-slate-200 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-200">
          {/* Brand Attribution */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/favicon.svg"
                alt="Splitwise Logo"
                className="w-9 h-9 rounded-xl shadow-md"
              />
              <span className="font-sans font-extrabold text-lg text-slate-900 tracking-tight">
                Splitwise
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
              Sabka hisaab, ek jagah. Built specifically for roommates, hostel students, PG residents, flatmates, families, and friends who share living expenses.
            </p>

            <div className="pt-2 text-xs text-slate-700 font-semibold flex items-center gap-1.5">
              <span>A product by</span>
              <span className="text-slate-900 font-bold tracking-wide underline decoration-emerald-500">
                Algorithyum
              </span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li><a href="#how-it-works" className="hover:text-emerald-700 transition-colors">How It Works</a></li>
              <li><a href="#who-its-for" className="hover:text-emerald-700 transition-colors">Who It's For</a></li>
              <li><a href="#settlement-demo" className="hover:text-emerald-700 transition-colors">Settlement Engine</a></li>
              <li><a href="#features" className="hover:text-emerald-700 transition-colors">Core Features</a></li>
              <li><a href="#ai-assistant" className="hover:text-emerald-700 transition-colors">Gemini AI Assistant</a></li>
            </ul>
          </div>

          {/* Who It's For */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Who It's For
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li><a href="#who-its-for" className="hover:text-emerald-700 transition-colors">Flatmates & Roommates</a></li>
              <li><a href="#who-its-for" className="hover:text-emerald-700 transition-colors">Hostel Students</a></li>
              <li><a href="#who-its-for" className="hover:text-emerald-700 transition-colors">PG Residents</a></li>
              <li><a href="#who-its-for" className="hover:text-emerald-700 transition-colors">Families</a></li>
              <li><a href="#who-its-for" className="hover:text-emerald-700 transition-colors">Vacation Trips</a></li>
            </ul>
          </div>

          {/* Legal & Connect */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Connect & Legal
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li><a href="#faq" className="hover:text-emerald-700 transition-colors">FAQ</a></li>
              <li><span className="text-slate-400 cursor-not-allowed">Privacy Policy</span></li>
              <li><span className="text-slate-400 cursor-not-allowed">Terms of Service</span></li>
            </ul>

            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                aria-label="GitHub Repository"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                aria-label="LinkedIn Profile"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-4">
          <div>
            © {new Date().getFullYear()} SplitWise • Algorithyum. All rights reserved.
          </div>
          <div className="flex items-center gap-1">
            Designed for shared living with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </div>
        </div>
      </div>
    </footer>
  );
};
