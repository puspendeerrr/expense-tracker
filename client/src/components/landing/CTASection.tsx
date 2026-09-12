import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export const CTASection: React.FC = () => {
  return (
    <section className="py-14 bg-[#FFF8F2]">
      <div className="max-w-6xl xl:max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#1E1E1E] to-[#2D2D2D] text-white shadow-2xl shadow-[#FF6B00]/10 border border-slate-800 space-y-5"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B00]/20 text-[#FF8C42] text-xs font-bold border border-[#FF6B00]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready to clear your expenses?</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Start Splitting Expenses Today
          </h2>

          <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed font-medium">
            Create your group, add shared expenses, and let SplitWise handle all calculation and balances automatically.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="w-full sm:w-auto h-11 px-8 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-[#FF6B00]/30 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
