import React, { useState } from 'react';
import { AccordionItem } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

export const LandingFAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does SplitMoney calculate splits fairly?',
      a: 'When an expense is split between roommates, SplitMoney calculates each person’s exact share down to the paisa. Any remainder is distributed cleanly so the sum of everyone’s share always equals the total bill.',
    },
    {
      q: 'Is SplitMoney free to use?',
      a: 'Yes, SplitMoney is 100% free for roommates, trips, and households. There are no hidden fees or charges.',
    },
    {
      q: 'How does the email verification code work?',
      a: 'When you sign up or reset your password, SplitMoney sends a secure 6-digit verification code to your email. This ensures your account is verified and protected.',
    },
    {
      q: 'Can flatmates pay each other directly with UPI?',
      a: 'Yes! SplitMoney supports UPI IDs and QR codes. When settling up, you can launch your preferred UPI app (Google Pay, PhonePe, Paytm, etc.) with the receiver’s details pre-filled.',
    },
    {
      q: 'How do balances stay accurate?',
      a: 'SplitMoney keeps direct balance records between members so you always know who owes whom without confusing or unexpected rerouting.',
    },
  ];

  return (
    <section id="faq" className="py-24 bg-[#09090B] border-t border-white/[0.06] relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-16">
          <Badge variant="secondary" className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
            Got Questions?
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-medium">
            Learn more about how SplitMoney handles group balances, math, and security.
          </p>
        </div>

        <div className="space-y-3.5">
          {faqs.map((faq, idx) => (
            <AccordionItem
              key={idx}
              title={faq.q}
              isOpen={openIndex === idx}
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
            >
              {faq.a}
            </AccordionItem>
          ))}
        </div>
      </div>
    </section>
  );
};

