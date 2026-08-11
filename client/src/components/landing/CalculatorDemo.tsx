import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export const CalculatorDemo: React.FC = () => {
  const [billAmount, setBillAmount] = useState<number>(2400);
  const [memberCount, setMemberCount] = useState<number>(4);

  const perPersonShare = Math.round(billAmount / (memberCount || 1));

  return (
    <section className="py-20 bg-white text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 inline-block">
            Interactive Calculator
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans text-slate-900">
            You add the expenses. We handle the calculation.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            No more opening phone calculators or typing math into WhatsApp. Try adjusting the bill below:
          </p>
        </div>

        {/* Interactive Bill Splitter Tool Card */}
        <div className="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200/80 shadow-lg">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bill Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={billAmount}
                    onChange={(e) => setBillAmount(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-3 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Number of Flatmates
                </label>
                <select
                  value={memberCount}
                  onChange={(e) => setMemberCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none shadow-sm"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} People
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Calculation Result */}
            <div className="p-6 rounded-2xl bg-slate-900 text-white text-center space-y-2 shadow-inner">
              <div className="text-xs text-slate-400 font-medium">
                ₹{billAmount.toLocaleString('en-IN')} ÷ {memberCount} members
              </div>
              <motion.div
                key={`${billAmount}-${memberCount}`}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl sm:text-5xl font-extrabold text-emerald-400 financial-num"
              >
                ₹{perPersonShare.toLocaleString('en-IN')}{' '}
                <span className="text-sm font-normal text-slate-300">each</span>
              </motion.div>
              <div className="text-[11px] text-emerald-400/90 font-mono">
                Calculated & updated automatically in group balances
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
