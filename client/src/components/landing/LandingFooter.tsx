import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-white border-t border-[#FF6B00]/15 pt-10 pb-8 text-[#1E1E1E]">
      <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-6">
        {/* Minimal Footer Top Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]" />
            <span>SplitWise Pro</span>
          </div>

          <div className="flex items-center gap-6 font-semibold text-xs text-[#1E1E1E]/70">
            <a href="/#features" className="hover:text-[#FF6B00] transition-colors">Features</a>
            <Link to="/founder" className="hover:text-[#FF6B00] transition-colors">Founder's Note</Link>
            <Link to="/developer" className="hover:text-[#FF6B00] transition-colors">Engineering</Link>
            <a
              href="https://algorithyum.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#FF6B00] transition-colors inline-flex items-center gap-1"
            >
              <span>Algorithmyum</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>

        {/* Minimal Copyright & Credits */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] font-medium text-slate-500 gap-3">
          <div>
            © {new Date().getFullYear()} SplitWise • Official Product of{' '}
            <a
              href="https://algorithyum.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#FF6B00] hover:underline"
            >
              Algorithmyum Software Solutions
            </a>
          </div>
          <div className="flex items-center gap-1">
            Developed with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline-block" /> by{' '}
            <a href="https://puspender.in" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1E1E1E] hover:text-[#FF6B00]">Puspender Kumar</a>
            <span>&</span>
            <a href="https://chaten.in" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1E1E1E] hover:text-[#FF6B00]">Chaten Toor</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
