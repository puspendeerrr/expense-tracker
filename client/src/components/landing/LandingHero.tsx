import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, QrCode, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const LandingHero: React.FC = () => {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-emerald-50/40 via-white to-slate-50">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/50 via-transparent to-transparent pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-300/60 text-emerald-800 text-xs font-bold shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Simple, Transparent Expense Sharing</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.12] font-sans">
            Split expenses with flatmates.{' '}
            <span className="text-emerald-700 bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-800">
              Zero math.
            </span>{' '}
            Instant settlements.
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto font-medium">
            The modern financial ledger built for roommates, trips, and shared households.
            Track shared bills, calculate splits accurately down to the paisa, and settle debts directly with UPI.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button asChild size="lg" className="w-full sm:w-auto text-base font-semibold px-8 h-12 shadow-md shadow-emerald-700/25">
              <Link to="/signup">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base font-semibold px-8 h-12 bg-white">
              <Link to="/login">Sign In to Group</Link>
            </Button>
          </div>

          {/* Key Value Micro-Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              100% Free for groups
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Secure email verification
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Direct 1-tap UPI links
            </span>
          </div>
        </div>

        {/* Realistic Interactive UI Showcase / Hero Mockup */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="relative rounded-3xl p-3 sm:p-4 bg-slate-900/5 border border-slate-200/80 shadow-2xl shadow-slate-900/10 backdrop-blur">
            <Card className="border-slate-200/90 shadow-none overflow-hidden rounded-2xl bg-white">
              {/* Mock App Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    ₹
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">Apartment 402 — Monthly Ledger</h4>
                    <p className="text-[11px] text-slate-500 font-medium">4 Flatmates • Active Cycle</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="verified" className="text-[11px] py-0.5 px-2">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Up to Date
                  </Badge>
                </div>
              </div>

              {/* Mock Dashboard Metric Cards */}
              <CardContent className="p-5 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Total Group Spend
                    </span>
                    <span className="text-2xl font-extrabold text-slate-900 font-mono">₹48,250.00</span>
                    <span className="text-[11px] text-emerald-600 font-medium block mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      14 split transactions
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Your Out-of-Pocket
                    </span>
                    <span className="text-2xl font-extrabold text-slate-900 font-mono">₹24,500.00</span>
                    <span className="text-[11px] text-slate-500 font-medium block mt-1">
                      Rent, WiFi, Groceries
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
                    <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block mb-1">
                      Your Net Balance
                    </span>
                    <span className="text-2xl font-extrabold text-emerald-700 font-mono">+₹4,250.00</span>
                    <span className="text-[11px] text-emerald-800 font-bold block mt-1">
                      You are owed across flatmates
                    </span>
                  </div>
                </div>

                {/* Person-Wise Live Debt Relationships */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span>Direct Pairwise Relationships</span>
                    <span>Action</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">
                          AK
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Aarav Kumar</p>
                          <p className="text-xs text-emerald-700 font-semibold">Owes you ₹2,150.00 (Groceries split)</p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                        <QrCode className="h-3.5 w-3.5" />
                        <span>UPI Request Ready</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center">
                          PS
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Priya Sharma</p>
                          <p className="text-xs text-emerald-700 font-semibold">Owes you ₹2,100.00 (Electricity bill)</p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                        <QrCode className="h-3.5 w-3.5" />
                        <span>UPI Request Ready</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                          VS
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Vikram Singh</p>
                          <p className="text-xs text-slate-500 font-medium">All settled up • Zero balance</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium">
                        Settled
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
