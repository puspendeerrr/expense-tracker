import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Sparkles, User, ArrowRight } from 'lucide-react';

export const AIDemoSection: React.FC = () => {
  const samplePrompts = [
    {
      q: 'Who owes me money right now?',
      a: 'Based on Goa Trip 2026 balance:\n• Aman owes you ₹1,200 (from Taj Dinner)\n• Priya owes you ₹1,250 (from Villa Booking)\n\nTotal owed to you: ₹2,450.',
    },
    {
      q: 'How much did we spend on food this month?',
      a: 'Your group spent ₹4,850 on Food & Dining in September. Your personal split share was ₹1,212.50.',
    },
    {
      q: 'Rahul ko kitna dena baki h?',
      a: 'Rahul is owed ₹2,500 total in the group. Your direct pairwise debt to Rahul is ₹350.',
    },
    {
      q: 'Summarize last week\'s settlements.',
      a: 'Last week 2 settlements were completed via UPI:\n• Aman paid Rahul ₹1,500 via UPI (Verified ✓)\n• Priya paid You ₹800 via UPI QR Code (Verified ✓)',
    },
  ];

  const [activePromptIndex, setActivePromptIndex] = useState(0);

  return (
    <section id="ai-assistant" className="py-20 bg-[#FFF8F2]">
      <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/25 text-[#FF6B00] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Powered by Google Gemini AI</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#1E1E1E] tracking-tight font-sans">
            Ask Your Expense History Anything.
          </h2>
          <p className="text-xs sm:text-sm text-[#1E1E1E]/80 leading-relaxed font-medium">
            No need to manually add up old bills or search spreadsheets. Talk to your built-in AI Assistant in plain English, Hindi, or Hinglish.
          </p>
        </div>

        {/* Interactive Chat Showcase */}
        <div className="max-w-5xl xl:max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Left Sample Question Chips */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-extrabold text-[#FF6B00] uppercase tracking-wider mb-2">
              Try asking these questions:
            </div>
            {samplePrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActivePromptIndex(idx)}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between gap-3 ${
                  activePromptIndex === idx
                    ? 'bg-white border-[#FF6B00] text-[#FF6B00] shadow-md shadow-[#FF6B00]/10'
                    : 'bg-white/70 border-slate-200 text-[#1E1E1E]/80 hover:border-[#FF6B00]/40'
                }`}
              >
                <span>“{item.q}”</span>
                <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${activePromptIndex === idx ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
              </button>
            ))}
          </div>

          {/* Right AI Live Chat Display */}
          <div className="lg:col-span-7">
            <div className="rounded-[20px] border border-[#FF6B00]/20 bg-white shadow-xl shadow-[#FF6B00]/5 overflow-hidden">
              {/* Header */}
              <div className="p-4 bg-[#FFF8F2] border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20 flex items-center justify-center font-bold">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1E1E1E] flex items-center gap-1.5">
                      Gemini Financial Assistant
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">Group: Goa Trip 2026</div>
                  </div>
                </div>
              </div>

              {/* Chat Window */}
              <div className="p-5 space-y-4 min-h-[240px] bg-slate-50/50 flex flex-col justify-end">
                <motion.div
                  key={`user-${activePromptIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 self-end max-w-[85%]"
                >
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] text-white text-xs font-bold rounded-tr-none shadow-sm">
                    {samplePrompts[activePromptIndex].q}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs shrink-0 font-bold">
                    <User className="w-3.5 h-3.5" />
                  </div>
                </motion.div>

                <motion.div
                  key={`ai-${activePromptIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-start gap-2.5 max-w-[90%]"
                >
                  <div className="w-7 h-7 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20 flex items-center justify-center text-xs shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-[#1E1E1E] text-xs leading-relaxed whitespace-pre-line rounded-tl-none font-medium shadow-sm">
                    {samplePrompts[activePromptIndex].a}
                  </div>
                </motion.div>
              </div>

              {/* Input Bar */}
              <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={samplePrompts[activePromptIndex].q}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-600 focus:outline-none"
                />
                <button className="p-2 rounded-xl bg-[#FF6B00] text-white font-bold shrink-0">
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
