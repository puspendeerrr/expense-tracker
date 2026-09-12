import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Shield, Zap, HeartHandshake } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-16 bg-[#FFF8F2]">
      <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#FF6B00]/20 shadow-xl shadow-[#FF6B00]/5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Text */}
            <div className="lg:col-span-7 space-y-4 text-center lg:text-left">
              <span className="inline-block px-3 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-xs font-bold uppercase tracking-wider">
                About SplitWise Pro
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1E1E1E] tracking-tight font-sans">
                Built for Simple Expense Sharing
              </h2>
              <p className="text-sm sm:text-base text-[#1E1E1E]/80 leading-relaxed font-medium">
                Expense Tracker helps groups manage shared expenses without spreadsheets or manual calculations.
              </p>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-[#1E1E1E]/80">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/15">
                  <CheckCircle2 className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
                  <span>No spreadsheet formulas</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/15">
                  <Zap className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
                  <span>Instant debt simplification</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/15">
                  <Shield className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
                  <span>Secure & private records</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/15">
                  <HeartHandshake className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
                  <span>Free forever for groups</span>
                </div>
              </div>
            </div>

            {/* Right Illustration */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm p-6 rounded-2xl bg-gradient-to-br from-[#FFF8F2] to-orange-50/80 border border-[#FF6B00]/20 shadow-inner space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center font-bold text-lg">
                    ₹
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#1E1E1E]">Smart Settlement Engine</h4>
                    <p className="text-[10px] text-slate-500">Minimizes total transactions</p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-slate-600 text-[11px]">
                    <span>Without SplitWise:</span>
                    <span className="text-rose-500">6 transactions</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#FF6B00] text-[11px]">
                    <span>With SplitWise:</span>
                    <span className="text-emerald-600">Only 2 payments!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
