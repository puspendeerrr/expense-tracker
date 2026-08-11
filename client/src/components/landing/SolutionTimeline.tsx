import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, PlusCircle, Calculator, CheckCircle2, ArrowRight } from 'lucide-react';

export const SolutionTimeline: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Create a Group',
      desc: 'Create a group for your flat, hostel room, family, trip or friends. Share via 6-digit Invite Code, Link, or QR code.',
      icon: <UserPlus className="w-5 h-5 text-emerald-400" />,
      detail: 'Invite code: FLAT99 • Group link: /join/FLAT99',
    },
    {
      num: '02',
      title: 'Add Expenses',
      desc: 'Record who paid, how much, and who shared the expense. Split equally or pick specific flatmates.',
      icon: <PlusCircle className="w-5 h-5 text-emerald-400" />,
      detail: 'Rent ₹12,000 • Groceries ₹4,850 • Electricity ₹2,400',
    },
    {
      num: '03',
      title: 'Automatic Calculation',
      desc: 'Our debt minimization engine calculates everyone\'s share automatically and optimizes minimum payments.',
      icon: <Calculator className="w-5 h-5 text-emerald-400" />,
      detail: '12 complex debts reduced to 3 simple settlements',
    },
    {
      num: '04',
      title: 'Settle Up via UPI',
      desc: 'Instantly see who owes whom. Scan the receiver\'s UPI QR code or pay directly, attach proof screenshot, and settle.',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      detail: 'Direct GPay / PhonePe / Paytm UPI integration',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-950 text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            Simple 4-Step Process
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans">
            Ab sabka hisaab, ek jagah.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            How Expense Tracker eliminates calculation headaches in under 30 seconds.
          </p>
        </div>

        {/* Timeline Steps Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              className="relative p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between hover:border-emerald-500/40 transition-all group hover:bg-slate-900"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-extrabold text-emerald-400 font-mono opacity-80">
                    {step.num}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    {step.icon}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  {step.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{step.detail}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
