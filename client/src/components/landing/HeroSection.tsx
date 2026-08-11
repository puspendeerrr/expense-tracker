import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Plus, Sparkles, Receipt, ArrowRightLeft, ShieldCheck, Zap } from 'lucide-react';
import { BackgroundBeams } from './ui/background-beams';
import { ButtonWithMovingBorder } from './ui/moving-border';

export const HeroSection: React.FC = () => {
  // Interactive mock state for Hero product card preview
  const [mockExpenses, setMockExpenses] = useState([
    { id: 1, title: 'Flat Rent (Sep)', amount: 12000, paidBy: 'Puspender', mode: 'UPI', date: 'Today' },
    { id: 2, title: 'Weekly Groceries', amount: 4850, paidBy: 'Sarthak', mode: 'Cash', date: 'Yesterday' },
    { id: 3, title: 'Electricity Bill', amount: 2400, paidBy: 'Aman', mode: 'UPI', date: '08 Sep' },
    { id: 4, title: 'WiFi Broadband', amount: 1000, paidBy: 'Mehak', mode: 'UPI', date: '05 Sep' },
  ]);
  const [addedSimulated, setAddedSimulated] = useState(false);

  const handleSimulateExpense = () => {
    if (addedSimulated) return;
    setMockExpenses([
      { id: 5, title: 'Dinner & Drinks 🍕', amount: 1800, paidBy: 'Mehak', mode: 'UPI', date: 'Just now' },
      ...mockExpenses,
    ]);
    setAddedSimulated(true);
  };

  const totalSpending = mockExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <section className="relative pt-20 pb-28 md:pt-28 md:pb-36 bg-slate-950 text-white overflow-hidden">
      {/* Aceternity Background Beams */}
      <BackgroundBeams />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Editorial Copy Column */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold tracking-wide backdrop-blur-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>SplitWise Pro — Shared Expense Management</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white font-sans leading-[1.1]"
            >
              Split Expenses.{' '}
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
                Minimalist. Intelligent.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0"
            >
              Track flatmate bills, split expenses, and settle dues with automated debt minimization. Designed with Apple-level precision and lightning speed.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2"
            >
              <Link to="/signup">
                <ButtonWithMovingBorder containerClassName="w-full sm:w-auto">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>Create Your Group</span>
                </ButtonWithMovingBorder>
              </Link>

              <Link
                to="/login"
                className="h-12 px-6 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-sm transition-all text-center backdrop-blur-md flex items-center justify-center gap-1.5 hover:border-slate-700 w-full sm:w-auto"
              >
                <span>Sign In to Console</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs font-medium text-slate-400"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-400" /> 100% Free to use
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Read-Only Inspector Audit
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-400" /> Real-time Socket Sync
              </span>
            </motion.div>
          </div>

          {/* Right Product Card Interactive Glass Mockup */}
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative rounded-3xl border border-slate-800/90 bg-slate-900/70 p-6 backdrop-blur-2xl shadow-2xl shadow-blue-600/10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">Survivor's Flatmates</h3>
                    <p className="text-xs text-slate-400">4 Active Members</p>
                  </div>
                </div>

                <button
                  onClick={handleSimulateExpense}
                  disabled={addedSimulated}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    addedSimulated
                      ? 'bg-slate-800 text-slate-500 cursor-default'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                  }`}
                >
                  {addedSimulated ? 'Simulated Added' : '+ Add Test Bill'}
                </button>
              </div>

              {/* Total Balance Card */}
              <div className="my-4 p-4 rounded-xl bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-slate-900/60 border border-blue-500/20 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Total Group Spending</span>
                  <p className="text-2xl font-bold text-blue-400">₹{totalSpending.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-blue-300 font-medium bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                    4 Shares Balanced
                  </span>
                </div>
              </div>

              {/* Expense List */}
              <div className="space-y-2.5">
                {mockExpenses.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-slate-200 text-sm">{item.title}</p>
                      <p className="text-xs text-slate-400">
                        Paid by {item.paidBy} • <span className="text-blue-400 font-medium">{item.mode}</span>
                      </p>
                    </div>
                    <span className="font-bold text-white text-sm">₹{item.amount.toLocaleString('en-IN')}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
