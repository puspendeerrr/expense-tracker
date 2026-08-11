import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, CheckCircle2 } from 'lucide-react';

export const BeforeAfterSection: React.FC = () => {
  const items = [
    {
      before: 'WhatsApp chat scrolling to find old payment proof',
      after: 'Cloudinary bill receipts & payment proof stored cleanly per expense',
    },
    {
      before: 'Phone calculator math & manual division mistakes',
      after: 'Automatic equal or specific member splitting with zero math',
    },
    {
      before: '12+ repetitive UPI transactions back and forth between flatmates',
      after: 'Smart debt minimization engine reducing debt to 3 clean settlements',
    },
    {
      before: 'Forgetting who paid for electricity, internet, or groceries',
      after: 'Centralized group dashboard visible to every flatmate in real time',
    },
    {
      before: 'Awkward reminders & argument over who owes whom',
      after: 'Instant push notifications & Gemini AI assistant to check exact balances',
    },
  ];

  return (
    <section className="py-20 bg-[#FAF9F6] text-slate-900 border-b border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 inline-block">
            Why Switch?
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans text-slate-900">
            Less calculating. Less confusion. More clarity.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            See how SplitWise transforms everyday group expense management.
          </p>
        </div>

        {/* Side-by-side Table */}
        <div className="max-w-4xl mx-auto space-y-3.5">
          {items.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-3xl bg-white border border-slate-200 shadow-sm"
            >
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-100">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="text-xs text-rose-900 font-medium leading-relaxed">
                  {item.before}
                </span>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-emerald-950 font-bold leading-relaxed">
                  {item.after}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
