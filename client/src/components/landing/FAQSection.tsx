import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const faqs = [
    {
      q: 'What is SplitWise?',
      a: 'SplitWise is a modern shared expense management app designed for roommates, hostel students, PG residents, flatmates, families, and trip groups in India. It keeps track of group bills, calculates who owes whom, and simplifies settlements.',
    },
    {
      q: 'Who is it for?',
      a: 'It is built specifically for people living or spending together — flatmates sharing rent and utilities, hostel students sharing mess bills, PG residents, families, and friends on weekend trips.',
    },
    {
      q: 'How do flatmates join my group?',
      a: 'When you create a group, a unique 6-character Invite Code, shareable Invite Link, and Group QR Code are generated. Flatmates can join instantly by scanning the QR code, entering the code, or clicking the invite link.',
    },
    {
      q: 'How are expenses split?',
      a: 'You can choose to split expenses equally among all group members or select specific members. SplitWise automatically computes each member\'s exact share.',
    },
    {
      q: 'How does the "Who Owes Whom" debt minimization work?',
      a: 'Instead of requiring dozens of individual payments back and forth, our debt minimization engine computes net balances across all group expenses and calculates the minimum required settlements.',
    },
    {
      q: 'How do settlements and UPI payments work?',
      a: 'Members can add their UPI ID and custom PhonePe / Google Pay QR code. When paying off debt, payers can scan the receiver\'s UPI QR code directly, attach a payment screenshot proof, and submit for verification.',
    },
    {
      q: 'Is there an AI Assistant?',
      a: 'Yes! SplitWise features a built-in Gemini AI Assistant. You can ask questions in natural language like “Who owes me money?” or “How much did we spend on food this month?”.',
    },
    {
      q: 'Is SplitWise free to use?',
      a: 'Yes! SplitWise is completely free for all shared living groups.',
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-white text-slate-900 relative border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 inline-block">
            Frequently Asked Questions
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans text-slate-900">
            Got Questions? We Have Answers.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Everything you need to know about using SplitWise for your group.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-slate-50 border border-slate-200/80 overflow-hidden transition-all hover:border-slate-300"
            >
              <button
                onClick={() => toggleFAQ(idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 focus:outline-none"
              >
                <span className="text-sm font-bold text-slate-900 font-sans">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${
                    openIndex === idx ? 'rotate-180 text-emerald-600' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {openIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3 font-sans">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
