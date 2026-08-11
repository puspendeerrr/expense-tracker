import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Plus, Sparkles, Receipt, ArrowRightLeft, ShieldCheck } from 'lucide-react';

export const HeroSection: React.FC = () => {
  // Interactive mock state for Hero product card preview
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements'>('expenses');
  const [mockExpenses, setMockExpenses] = useState([
    { id: 1, title: 'House Rent (Sep)', amount: 12000, paidBy: 'Puspender', category: 'Rent', date: 'Today' },
    { id: 2, title: 'Weekly Groceries', amount: 4850, paidBy: 'Sarthak', category: 'Groceries', date: 'Yesterday' },
    { id: 3, title: 'Electricity Bill', amount: 2400, paidBy: 'Aman', category: 'Utilities', date: '08 Sep' },
    { id: 4, title: 'WiFi Broadband', amount: 1000, paidBy: 'Mehak', category: 'Internet', date: '05 Sep' },
  ]);
  const [addedSimulated, setAddedSimulated] = useState(false);

  const handleSimulateExpense = () => {
    if (addedSimulated) return;
    setMockExpenses([
      { id: 5, title: 'Sunday Dinner & Snacks 🍕', amount: 1800, paidBy: 'Mehak', category: 'Food', date: 'Just now' },
      ...mockExpenses,
    ]);
    setAddedSimulated(true);
  };

  const totalSpending = mockExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <section className="relative pt-12 pb-20 md:pt-16 md:pb-28 bg-[#FAF9F6] text-slate-900 overflow-hidden">
      {/* Subtle Radial Glow & Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.8) 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Editorial Copy Column */}
          <div className="lg:col-span-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/90 border border-emerald-300 text-emerald-800 text-xs font-bold tracking-wide shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Splitwise — Shared Expense Management for India</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 font-sans leading-[1.1]"
            >
              Hisaab ab idhar-udhar nahi.{' '}
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                Sabka hisaab, ek jagah.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl"
            >
              Rent, groceries, electricity, trips — jo bhi share karte ho, uska hisaab ab <strong>Splitwise</strong> mein. Track shared expenses, split bills, and know who owes whom without spreadsheets or WhatsApp math.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2"
            >
              <Link
                to="/signup"
                className="h-12 px-7 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-emerald-500/35 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create Your Group</span>
              </Link>

              <a
                href="#how-it-works"
                className="h-12 px-6 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-sm transition-all text-center shadow-sm flex items-center justify-center gap-1.5 hover:border-slate-400"
              >
                See How It Works
              </a>
            </motion.div>

            {/* Human Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 100% Free to use
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zero manual calculations
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Direct UPI payment & QR
              </span>
            </motion.div>
          </div>

          {/* Right Photographic + Modern Glass Product UI Composition */}
          <div className="lg:col-span-6 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-white group hover:shadow-emerald-500/10 transition-shadow duration-500"
            >
              {/* Editorial Photograph Banner */}
              <div className="relative h-48 sm:h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80"
                  alt="Flatmates hanging out together sharing expenses"
                  className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex items-end p-5">
                  <div className="text-white">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 shadow-sm">
                      Splitwise Live Group
                    </span>
                    <h3 className="text-lg font-extrabold mt-1">Flatmates — September 2026</h3>
                  </div>
                </div>
              </div>

              {/* Glass & Dark Product Preview Details */}
              <div className="p-5 sm:p-6 space-y-4 bg-slate-900 text-white backdrop-blur-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Total Shared Spending</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white financial-num mt-0.5 tracking-tight">
                      ₹{totalSpending.toLocaleString('en-IN')}
                      {addedSimulated && <span className="text-xs text-emerald-400 ml-2 font-normal animate-pulse">+₹1,800</span>}
                    </div>
                  </div>

                  <button
                    onClick={handleSimulateExpense}
                    disabled={addedSimulated}
                    className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow ${
                      addedSimulated
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-105'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    {addedSimulated ? 'Expense Added!' : 'Add Sample Expense'}
                  </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      activeTab === 'expenses'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Recent Expenses ({mockExpenses.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('settlements')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      activeTab === 'settlements'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Minimum Settlements (3)
                  </button>
                </div>

                {/* Content */}
                {activeTab === 'expenses' ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {mockExpenses.map((exp) => (
                      <div key={exp.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors">
                        <div>
                          <div className="font-bold text-slate-100">{exp.title}</div>
                          <div className="text-[10px] text-slate-400">Paid by <strong className="text-slate-200">{exp.paidBy}</strong> • {exp.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-white financial-num">₹{exp.amount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-emerald-400 font-medium">₹{(exp.amount / 4).toLocaleString('en-IN')} each</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[
                      { from: 'Aman', to: 'Puspender', amount: 2662, mode: 'UPI (PhonePe)' },
                      { from: 'Mehak', to: 'Puspender', amount: 4062, mode: 'UPI (Google Pay)' },
                      { from: 'Sarthak', to: 'Puspender', amount: 212, mode: 'Cash' },
                    ].map((s, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-200">{s.from}</span>
                          <ArrowRight className="w-3 h-3 text-emerald-400" />
                          <span className="font-bold text-slate-200">{s.to}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{s.mode}</span>
                        </div>
                        <div className="font-extrabold text-emerald-400 financial-num">₹{s.amount.toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
