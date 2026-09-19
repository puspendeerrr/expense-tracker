import React from 'react';
import { KeyRound, Lock, Database, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const LandingSecurity: React.FC = () => {
  const securityItems = [
    {
      icon: Clock,
      title: 'Fast & Secure Sign-In',
      desc: 'One-time verification codes sent straight to your email with built-in rate limits to protect your account.',
    },
    {
      icon: Lock,
      title: 'Bank-Grade Password Protection',
      desc: 'All passwords are encrypted with industry-standard bcrypt hashing. Your credentials are never stored in plain text.',
    },
    {
      icon: KeyRound,
      title: 'Protected Web Sessions',
      desc: 'Secure session tokens safeguard your login so you stay signed in safely without exposing sensitive data.',
    },
    {
      icon: Database,
      title: 'Accurate Real-Time Balances',
      desc: 'Every split and settlement updates instantly and reliably so group totals always match without discrepancies.',
    },
  ];

  return (
    <section id="security" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-14">
          <Badge variant="verified" className="text-xs font-bold uppercase tracking-wider">
            Security & Privacy
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight font-sans">
            Built with Security & Privacy First
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
            Your personal data and group finances are protected with modern, reliable security standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {securityItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card key={idx} className="rounded-2xl border-slate-200/90 hover:border-emerald-300 transition-colors shadow-sm">
                <CardContent className="p-6 sm:p-7 space-y-3">
                  <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
