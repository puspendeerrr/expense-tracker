import React, { useState } from 'react';
import { AccordionItem } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

export const LandingFAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does SplitWise calculate splits fairly?',
      a: 'When an expense is split between roommates, SplitWise calculates each person’s exact share down to the paisa. Any remainder is distributed cleanly so the sum of everyone’s share always equals the total bill.',
    },
    {
      q: 'Is SplitWise free to use?',
      a: 'Yes, SplitWise is 100% free for roommates, trips, and households. There are no hidden fees or charges.',
    },
    {
      q: 'How does the email verification code work?',
      a: 'When you sign up or reset your password, SplitWise sends a secure 6-digit verification code to your email. This ensures your account is verified and protected.',
    },
    {
      q: 'Can flatmates pay each other directly with UPI?',
      a: 'Yes! SplitWise supports UPI IDs and QR codes. When settling up, you can launch your preferred UPI app (Google Pay, PhonePe, Paytm, etc.) with the receiver’s details pre-filled.',
    },
    {
      q: 'How do balances stay accurate?',
      a: 'SplitWise keeps direct balance records between members so you always know who owes whom without confusing or unexpected rerouting.',
    },
  ];

  return (
    <section id="faq" className="py-20 bg-slate-50 border-t border-slate-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-14">
          <Badge variant="secondary" className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Got Questions?
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight font-sans">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
            Learn more about how SplitWise handles group balances, math, and security.
          </p>
        </div>

        <div className="space-y-3">
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

