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
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Built for Flatmates</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight font-sans">
            Built for Real Shared Living
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
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
                className="group hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-950/5 transition-all duration-200 rounded-2xl flex flex-col justify-between"
              >
                <CardContent className="p-6 sm:p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-semibold text-slate-600">
                      {item.badge}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed font-normal">
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

