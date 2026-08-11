import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, ArrowRight, CheckCircle, AlertTriangle, Sparkles, Check } from 'lucide-react';

export const ProblemSection: React.FC = () => {
  const conversationBubbles = [
    { text: '“Bhai, electricity ka bill kisne diya is baar?”', sender: 'Aman (Roommate 1)', side: 'left' },
    { text: '“Maine groceries ke ₹4,850 online diye the!”', sender: 'Sarthak (Roommate 2)', side: 'right' },
    { text: '“Ruk, WhatsApp group chat scroll karke check karta hoon...”', sender: 'Mehak (Roommate 3)', side: 'left' },
    { text: '“Sabka total kitna bana aur main kitne deon?”', sender: 'Puspender (Roommate 4)', side: 'right' },
    { text: '“Tu mujhe ₹600 dega ya main tujhe ₹450 doon?”', sender: 'Hostel Flatmate', side: 'left' },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-white text-slate-900 border-t border-slate-200 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-50 border border-amber-200 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Real Everyday Living Chaos
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans text-slate-900">
            Every flatmate group has had this conversation.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            When living with flatmates or hostel buddies, expense records get buried under hundreds of daily WhatsApp chats, paper notes, and confusing calculator math.
          </p>
        </div>

        {/* Narrative Scene Layout */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Realistic Conversation Thread */}
          <div className="lg:col-span-7 space-y-3.5 p-6 rounded-3xl bg-slate-50 border border-slate-200/80 shadow-inner">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Flatmates WhatsApp Group Chat</span>
              <span className="text-[10px] text-rose-500 font-mono">14 Unread Messages</span>
            </div>

            {conversationBubbles.map((bubble, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: bubble.side === 'left' ? -15 : 15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className={`flex flex-col ${bubble.side === 'right' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-xs font-medium leading-relaxed shadow-sm ${
                    bubble.side === 'right'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  {bubble.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 font-mono">{bubble.sender}</span>
              </motion.div>
            ))}
          </div>

          {/* Right: The Instant Resolution Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl space-y-4 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                ✓
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight">
                Ab app sambhalega.
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                No more scroll-hunting WhatsApp or arguing over who paid for chai, groceries, or Wi-Fi. Just add the bill amount and who paid. SplitWise calculates the shares and shows exact balances.
              </p>

              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span><strong>You add the expense.</strong> We do the math.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span><strong>Kisne pay kiya?</strong> App ko pata hai.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span><strong>Kisko kitna dena hai?</strong> App bata dega.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
