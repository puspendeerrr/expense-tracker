import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Check,
  ArrowDown,
  Users,
  CheckCircle2,
  ShieldCheck,
  Plane,
  Home,
  Briefcase,
  UserCheck,
  Receipt,
  Scale,
  Zap,
} from 'lucide-react';

export const HeroSection: React.FC = () => {
  const audienceTags = [
    { label: 'Roommates & Flatmates', icon: <Home className="w-3.5 h-3.5 text-[#FF6B00]" /> },
    { label: 'Trips & Vacations', icon: <Plane className="w-3.5 h-3.5 text-[#FF6B00]" /> },
    { label: 'Hostel & PG', icon: <Users className="w-3.5 h-3.5 text-[#FF6B00]" /> },
    { label: 'Families & Teams', icon: <Briefcase className="w-3.5 h-3.5 text-[#FF6B00]" /> },
  ];

  return (
    <section className="relative overflow-hidden pt-2 pb-6 lg:pt-3 lg:pb-8 lg:min-h-[calc(100vh-4.5rem)] flex items-center bg-[#FFF8F2]">
      {/* Ambient Orange Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#FF6B00]/10 via-[#FF8C42]/8 to-orange-200/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-6 space-y-4 lg:space-y-5 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/25 text-[#FF6B00] text-xs font-extrabold tracking-wide"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Expense Tracker with Instant UPI Settlements</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="text-3xl sm:text-4xl lg:text-[2.65rem] xl:text-5xl font-black text-[#1E1E1E] tracking-tight leading-[1.12] font-sans"
            >
              Split Group Expenses &{' '}
              <span className="bg-gradient-to-r from-[#FF6B00] via-[#FF8C42] to-[#FF6B00] bg-clip-text text-transparent">
                Settle Instantly via UPI.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="text-sm sm:text-base text-[#1E1E1E]/80 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium"
            >
              Built for flatmates, trips, hostel rooms & families. Log shared bills, track who owes whom, and pay via UPI QR code in seconds.
            </motion.p>

            {/* Audience Badges */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 pt-0.5"
            >
              {audienceTags.map((tag) => (
                <div
                  key={tag.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#FF6B00]/20 text-[#1E1E1E] text-xs font-semibold shadow-sm hover:border-[#FF6B00]/40 transition-colors"
                >
                  <Check className="w-3.5 h-3.5 text-[#FF6B00] stroke-[3]" />
                  <span>{tag.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
              className="pt-1 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
            >
              <Link
                to="/signup"
                className="w-full sm:w-auto h-11 px-7 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] hover:scale-[1.03] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#FF6B00]/25 flex items-center justify-center gap-2 transition-all duration-200"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>

              <a
                href="#features"
                className="w-full sm:w-auto h-11 px-6 rounded-full bg-white text-[#1E1E1E] border border-slate-200 hover:border-[#FF6B00]/40 hover:text-[#FF6B00] hover:scale-[1.03] font-semibold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all duration-200"
              >
                <span>Explore Core Features</span>
              </a>
            </motion.div>

            {/* Micro Trust Line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="pt-1 flex items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-[#1E1E1E]/60"
            >
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-[#FF6B00]" /> 100% Free Forever
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#FF6B00]" /> No Credit Card Required
              </span>
            </motion.div>
          </div>

          {/* Right Column: Compact 3-Step Visual Flowchart + Small Balance Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="lg:col-span-6 relative"
          >
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Glassmorphic Container Shell */}
              <div className="bg-white/95 rounded-[22px] p-4 sm:p-5 border border-[#FF6B00]/20 shadow-xl shadow-[#FF6B00]/10 backdrop-blur-md space-y-3.5 hover:shadow-2xl hover:border-[#FF6B00]/30 transition-all duration-300">
                {/* Header Badge */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FF6B00] flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-[#FF6B00]" />
                    Real Product Workflow
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">3-Second Concept</span>
                </div>

                {/* Step 1: Create Group */}
                <div className="p-3 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FF6B00] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#1E1E1E]">1. Create Group</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Invite via 6-digit code or QR link</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-[#FF6B00]/30 text-[10px] font-mono font-bold text-[#FF6B00]">
                    Code: AX789K
                  </span>
                </div>

                {/* Down Arrow 1 */}
                <div className="flex justify-center py-0">
                  <div className="w-5 h-5 rounded-full bg-[#FFF8F2] border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00]">
                    <ArrowDown className="w-3 h-3 stroke-[2.5]" />
                  </div>
                </div>

                {/* Step 2: Add Expenses */}
                <div className="p-3 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/20 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#FF8C42] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    <Receipt className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#1E1E1E]">2. Add Expenses</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Split equal or assign custom shares</p>
                  </div>
                </div>

                {/* Down Arrow 2 */}
                <div className="flex justify-center py-0">
                  <div className="w-5 h-5 rounded-full bg-[#FFF8F2] border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00]">
                    <ArrowDown className="w-3 h-3 stroke-[2.5]" />
                  </div>
                </div>

                {/* Step 3: Settle Instantly */}
                <div className="p-3 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/20 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FF6B00] to-[#FF8C42] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    <Scale className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#1E1E1E]">3. Settle Instantly</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Auto pairwise balances & 1-tap UPI QR</p>
                  </div>
                </div>

                {/* Small Balance Card */}
                <div className="pt-2.5 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-[10px] font-extrabold border border-[#FF6B00]/20">
                      Goa Trip 2026
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">Real-Time Balances</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs font-medium">
                    <div className="flex items-center justify-between text-slate-700 text-[11px]">
                      <span>Rahul paid</span>
                      <span className="font-bold text-[#1E1E1E]">₹ 2,500</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-700 text-[11px]">
                      <span>Priya paid</span>
                      <span className="font-bold text-[#1E1E1E]">₹ 1,800</span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#FFF8F2] border border-[#FF6B00]/25 font-bold text-[#1E1E1E] text-[11px]">
                      <span>You owe Rahul</span>
                      <span className="text-[#FF6B00]">₹ 350</span>
                    </div>
                  </div>

                  {/* Settled Badge */}
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-1.5 text-emerald-800 text-[11px] font-extrabold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                    <span>Settled in one click via UPI QR Code</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
