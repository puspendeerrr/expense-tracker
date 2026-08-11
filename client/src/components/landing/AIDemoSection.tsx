import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Sparkles, User, ArrowRight } from 'lucide-react';

export const AIDemoSection: React.FC = () => {
  const samplePrompts = [
    {
      q: 'Who owes me money right now?',
      a: 'Based on Flatmates September hisaab:\n• Aman owes you ₹2,662 (from House Rent)\n• Mehak owes you ₹4,062 (from House Rent)\n• Sarthak owes you ₹212\n\nTotal owed to you: ₹6,936.',
    },
    {
      q: 'How much did we spend on groceries this month?',
      a: 'Your group spent ₹4,850 on Groceries in September (paid by Sarthak on 07 Sep). Your personal share was ₹1,212.50.',
    },
    {
      q: 'What were our biggest group expenses?',
      a: 'Top expenses for Flatmates in September:\n1. House Rent — ₹12,000 (Paid by Puspender)\n2. Weekly Groceries — ₹4,850 (Paid by Sarthak)\n3. Electricity Bill — ₹2,400 (Paid by Aman)\n4. Sunday Dinner — ₹1,800 (Paid by Mehak)',
    },
    {
      q: 'Summarize last week\'s settlements.',
      a: 'Last week 2 settlements were completed:\n• Aman paid Puspender ₹1,500 via UPI (Verified ✓)\n• Mehak paid Sarthak ₹800 via Cash (Verified ✓)',
    },
  ];

  const [activePromptIndex, setActivePromptIndex] = useState(0);

  return (
    <section id="ai-assistant" className="py-20 bg-slate-900 text-white relative border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Powered by Google Gemini AI</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans">
            Ask your Hisaab anything.
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            No need to search through old transactions or manually add up bills. Talk to your built-in AI Assistant in plain natural language.
          </p>
        </div>

        {/* Interactive Chat Box */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Sample Question Chips */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Try asking these questions:
            </div>
            {samplePrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActivePromptIndex(idx)}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between gap-3 ${
                  activePromptIndex === idx
                    ? 'bg-slate-950 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>“{item.q}”</span>
                <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${activePromptIndex === idx ? 'text-cyan-400' : 'text-slate-600'}`} />
              </button>
            ))}
          </div>

          {/* Right AI Live Chat Display */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      Gemini Hisaab Assistant
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[10px] text-slate-400">Group: Flatmates September</div>
                  </div>
                </div>
              </div>

              {/* Window */}
              <div className="p-5 space-y-4 min-h-[260px] bg-slate-950 flex flex-col justify-end">
                <motion.div
                  key={`user-${activePromptIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 self-end max-w-[85%]"
                >
                  <div className="p-3.5 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-bold rounded-tr-none shadow">
                    {samplePrompts[activePromptIndex].q}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-xs shrink-0 font-bold">
                    <User className="w-3.5 h-3.5" />
                  </div>
                </motion.div>

                <motion.div
                  key={`ai-${activePromptIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="flex items-start gap-2.5 max-w-[90%]"
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-xs leading-relaxed whitespace-pre-line rounded-tl-none font-sans">
                    {samplePrompts[activePromptIndex].a}
                  </div>
                </motion.div>
              </div>

              {/* Input Bar */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={samplePrompts[activePromptIndex].q}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none"
                />
                <button className="p-2 rounded-xl bg-cyan-500 text-slate-950 font-bold shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
