import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, RefreshCw, Zap, ShieldCheck, QrCode } from 'lucide-react';

export const DebtMinimizationDemo: React.FC = () => {
  const [settlements, setSettlements] = useState([
    { id: 1, from: 'Aman', to: 'Puspender', amount: 2662, mode: 'UPI (Google Pay)', settled: false },
    { id: 2, from: 'Mehak', to: 'Puspender', amount: 4062, mode: 'UPI (PhonePe)', settled: false },
    { id: 3, from: 'Sarthak', to: 'Puspender', amount: 212, mode: 'Cash', settled: false },
  ]);

  const [activeView, setActiveView] = useState<'optimized' | 'chaotic'>('optimized');

  const toggleSettle = (id: number) => {
    setSettlements(
      settlements.map((s) => (s.id === id ? { ...s, settled: !s.settled } : s))
    );
  };

  const resetSettlements = () => {
    setSettlements(settlements.map((s) => ({ ...s, settled: false })));
  };

  const settledCount = settlements.filter((s) => s.settled).length;
  const remainingTotal = settlements
    .filter((s) => !s.settled)
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <section id="settlement-demo" className="py-20 bg-slate-950 text-white relative border-t border-b border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            Debt Minimization Engine
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans">
            Stop calculating who owes whom.
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Instead of 12 confusing payments back and forth across 4 flatmates, our smart algorithm condenses the entire group debt into minimum required transactions.
          </p>
        </div>

        {/* View Toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveView('optimized')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeView === 'optimized'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" /> With SplitWise (3 Payments)
            </button>
            <button
              onClick={() => setActiveView('chaotic')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeView === 'chaotic'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Without SplitWise (12 Payments)
            </button>
          </div>
        </div>

        {/* Interactive Workspace */}
        <div className="mt-10 max-w-4xl mx-auto">
          {activeView === 'optimized' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-emerald-500/30 backdrop-blur-xl shadow-2xl shadow-emerald-500/10 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Smart Debt Algorithm Active
                  </div>
                  <h3 className="text-2xl font-bold text-white mt-1">Flatmates Settlement Workspace</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Remaining pending group debt:{' '}
                    <strong className="text-emerald-400 font-mono text-sm">
                      ₹{remainingTotal.toLocaleString('en-IN')}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {settledCount > 0 && (
                    <button
                      onClick={resetSettlements}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reset Demo
                    </button>
                  )}
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    {settledCount} of 3 Settled
                  </div>
                </div>
              </div>

              {/* Settlement Cards */}
              <div className="space-y-3.5">
                <AnimatePresence>
                  {settlements.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      className={`p-4.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        item.settled
                          ? 'bg-slate-950/40 border-slate-800/50 opacity-60 line-through'
                          : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            item.settled
                              ? 'bg-slate-800 text-slate-500'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {item.settled ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : '₹'}
                        </div>

                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{item.from}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{item.to}</span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>{item.mode}</span>
                            <span>•</span>
                            <span className="text-emerald-400 flex items-center gap-1">
                              <QrCode className="w-3 h-3" /> UPI QR Code
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="text-right">
                          <div className="text-lg font-extrabold text-white financial-num">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-400">Calculated share</div>
                        </div>

                        <button
                          onClick={() => toggleSettle(item.id)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow ${
                            item.settled
                              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-105'
                          }`}
                        >
                          {item.settled ? 'Settled ✓' : 'Mark as Settled'}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="pt-2 text-center text-xs text-slate-400 font-medium">
                Try clicking <strong>“Mark as Settled”</strong> above to see how live balances update in real-time.
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-rose-500/30 backdrop-blur-xl space-y-4"
            >
              <div className="text-rose-400 text-xs font-bold uppercase tracking-wider">
                Traditional Manual Chaos (12 Individual Payments)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Without debt minimization, everyone pays everyone back individually for every single expense, resulting in confusion, forgotten money, and endless UPI transfers.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-300 font-mono">
                {[
                  'Aman → Puspender ₹3,000 (Rent)',
                  'Sarthak → Puspender ₹3,000 (Rent)',
                  'Mehak → Puspender ₹3,000 (Rent)',
                  'Puspender → Sarthak ₹1,212 (Groceries)',
                  'Aman → Sarthak ₹1,212 (Groceries)',
                  'Mehak → Sarthak ₹1,212 (Groceries)',
                  'Puspender → Aman ₹600 (Electricity)',
                  'Sarthak → Aman ₹600 (Electricity)',
                  'Mehak → Aman ₹600 (Electricity)',
                  'Puspender → Mehak ₹250 (WiFi)',
                  'Sarthak → Mehak ₹250 (WiFi)',
                  'Aman → Mehak ₹250 (WiFi)',
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-rose-300/90 font-medium">
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};
