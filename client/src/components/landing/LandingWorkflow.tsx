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
    <section id="how-it-works" className="py-24 bg-[#09090B] border-y border-white/[0.06] relative">
      {/* Subtle ambient light */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-blue-600/[0.05] blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <Badge variant="secondary" className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
            Frictionless Flow
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            How SplitMoney Works
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-medium">
            Three simple steps to total clarity over shared expenses and zero awkward money talks.
          </p>
        </div>

        {/* 3 Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative mb-20">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="relative p-7 rounded-2xl bg-[#18181B] border border-white/[0.08] shadow-xl shadow-black/40 flex flex-col justify-between space-y-4 hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold font-mono text-emerald-500/30 group-hover:text-emerald-400/60 transition-colors">
                  {step.number}
                </span>
                <div className="h-8 w-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {idx + 1}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Showcase: Without vs With SplitMoney */}
        <div id="settlement" className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              Debt Simplification: Before &amp; After
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              See how smart balance simplification cleans up chaotic group debts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Without SplitMoney */}
            <Card className="border border-red-500/20 bg-[#18181B]/80 rounded-2xl shadow-xl shadow-black/40">
              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
                    Without SplitMoney
                  </span>
                  <Badge variant="destructive" className="text-[11px] bg-red-500/15 text-red-400 border border-red-500/30">
                    Chaotic &amp; Unclear
                  </Badge>
                </div>

                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>6-8 messy payments back and forth between flatmates.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Rounding errors leave balances slightly off.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Awkward reminders: &quot;Hey, can you pay for dinner?&quot;.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Unclear calculations leave roommates unsure who owes what.</span>
                  </li>
                </ul>

                <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-center text-xs font-bold text-red-300">
                  Result: ₹3,400 scattered across 6 separate transfers
                </div>
              </CardContent>
            </Card>

            {/* With SplitMoney */}
            <Card className="border border-emerald-500/30 bg-emerald-950/15 rounded-2xl shadow-xl shadow-emerald-950/30 backdrop-blur-md">
              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                    With SplitMoney
                  </span>
                  <Badge variant="verified" className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Instant Peace of Mind
                  </Badge>
                </div>

                <ul className="space-y-3 text-sm text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Minimizes to only 2 direct, transparent payments.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Exact split calculations guarantee every rupee and paisa matches.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>1-tap UPI links launch your favorite UPI app directly.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Payment confirmations ensure mutual peace of mind.</span>
                  </li>
                </ul>

                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5 shadow-sm">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
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
