import React from 'react';
import { Check, X, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const LandingWorkflow: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Create or Join Your Group',
      desc: 'Set up an apartment or trip group in 10 seconds. Invite flatmates with a quick 6-digit code or direct link.',
    },
    {
      number: '02',
      title: 'Log Shared Expenses',
      desc: 'Record grocery runs, electricity, rent, or dinner. Split equally among everyone or specify exact custom shares.',
    },
    {
      number: '03',
      title: 'Settle in 1 Tap via UPI',
      desc: 'Pay flatmates directly using their pre-configured UPI IDs or QR codes. The recipient verifies and debts clear instantly.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-50 border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <Badge variant="secondary" className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Frictionless Flow
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight font-sans">
            How SplitWise Works
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
            Three simple steps to total clarity over shared expenses and zero awkward money talks.
          </p>
        </div>

        {/* 3 Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative mb-20">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="relative p-7 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold font-mono text-emerald-700/30">
                  {step.number}
                </span>
                <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  {idx + 1}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Showcase: Without vs With SplitWise */}
        <div id="settlement" className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              Debt Simplification: Before & After
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              See how smart balance simplification cleans up chaotic group debts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Without SplitWise */}
            <Card className="border-red-200/80 bg-red-50/20 rounded-2xl shadow-sm">
              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-red-900 uppercase tracking-wider">
                    Without SplitWise
                  </span>
                  <Badge variant="destructive" className="text-[11px]">
                    Chaotic & Unclear
                  </Badge>
                </div>

                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>6-8 messy payments back and forth between flatmates.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Rounding errors leave balances slightly off.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Awkward reminders: "Hey, can you pay for dinner?".</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Unclear calculations leave roommates unsure who owes what.</span>
                  </li>
                </ul>

                <div className="p-3 bg-red-100/50 rounded-xl text-center text-xs font-bold text-red-900">
                  Result: ₹3,400 scattered across 6 separate transfers
                </div>
              </CardContent>
            </Card>

            {/* With SplitWise */}
            <Card className="border-emerald-200 bg-emerald-50/30 rounded-2xl shadow-sm">
              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-950 uppercase tracking-wider">
                    With SplitWise
                  </span>
                  <Badge variant="verified" className="text-[11px] bg-emerald-100 text-emerald-800">
                    Instant Peace of Mind
                  </Badge>
                </div>

                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Minimizes to only 2 direct, transparent payments.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Exact split calculations guarantee every rupee and paisa matches.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>1-tap UPI links launch your favorite UPI app directly.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Payment confirmations ensure mutual peace of mind.</span>
                  </li>
                </ul>

                <div className="p-3 bg-emerald-100/70 rounded-xl text-center text-xs font-bold text-emerald-900 flex items-center justify-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Result: 2 direct transfers, settled in under 30 seconds</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
