import React from 'react';
import { Users, Scale, QrCode, ShieldCheck, FileCheck2, Calculator, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const LandingFeatures: React.FC = () => {
  const features = [
    {
      icon: Users,
      badge: 'Groups',
      title: 'Quick Invites & Instant Joining',
      description:
        'Create groups for flatmates, trips, or households in seconds. Invite members with a simple invite code or direct link.',
    },
    {
      icon: Calculator,
      badge: 'Fair Splits',
      title: 'Exact Split Calculations',
      description:
        'Split bills evenly or customize by exact amounts. Automatic remainder handling ensures every rupee adds up cleanly.',
    },
    {
      icon: QrCode,
      badge: 'UPI Payments',
      title: '1-Tap UPI Settlements',
      description:
        'Pay friends directly using Google Pay, PhonePe, Paytm, or BHIM with zero fees and instant confirmation.',
    },
    {
      icon: Scale,
      badge: 'Clear Balances',
      title: 'Direct Balance Tracking',
      description:
        'Always see exactly who owes whom. Clear debt summaries eliminate confusion between flatmates.',
    },
    {
      icon: FileCheck2,
      badge: 'Verification',
      title: 'Payment Confirmations',
      description:
        'When you make a payment, the recipient confirms receipt so everyone stays in sync with peace of mind.',
    },
    {
      icon: ShieldCheck,
      badge: 'Privacy & Security',
      title: 'Secure Account Protection',
      description:
        'Protected logins, encrypted data, and private group ledgers keep your personal finances safe.',
    },
  ];

  return (
    <section id="features" className="py-24 bg-[#09090B] relative">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-emerald-500/[0.04] blur-[150px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Built for Flatmates</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Built for Real Shared Living
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-medium">
            Everything your household needs to record expenses, eliminate awkward reminders, and settle debts instantly.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card
                key={idx}
                className="group border border-white/[0.08] bg-[#18181B]/90 hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-950/20 transition-all duration-300 rounded-2xl flex flex-col justify-between"
              >
                <CardContent className="p-6 sm:p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-gradient-to-tr group-hover:from-emerald-500 group-hover:to-teal-500 group-hover:text-white transition-all duration-300 shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-semibold text-slate-300 bg-[#1F2937] border border-white/[0.06]">
                      {item.badge}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed font-normal">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

