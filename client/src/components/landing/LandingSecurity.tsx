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
    <section id="security" className="py-24 bg-[#09090B] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-16">
          <Badge variant="verified" className="text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Security &amp; Privacy
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Built with Security &amp; Privacy First
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-medium">
            Your personal data and group finances are protected with modern, reliable security standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {securityItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card
                key={idx}
                className="group rounded-2xl border border-white/[0.08] bg-[#18181B]/90 hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300 shadow-xl shadow-black/30"
              >
                <CardContent className="p-6 sm:p-7 space-y-3">
                  <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-gradient-to-tr group-hover:from-emerald-500 group-hover:to-teal-500 group-hover:text-white transition-all duration-300 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
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
