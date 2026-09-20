import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, QrCode, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const LandingHero: React.FC = () => {
  return (
    <section className="relative pt-14 pb-20 md:pt-22 md:pb-32 overflow-hidden bg-[#09090B]">
      {/* Background Decorative Mesh & Radial Glows (Vercel/Linear style) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[620px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(16,185,129,0.12),rgba(2,105,252,0.08),transparent_70%)] pointer-events-none -z-10" />
      <div className="absolute top-1/4 -left-48 w-96 h-96 rounded-full bg-emerald-500/[0.07] blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 rounded-full bg-blue-600/[0.07] blur-[120px] pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(9,9,11,0.5)_100%)] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold shadow-lg shadow-emerald-950/20 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Simple, Transparent Expense Sharing</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12] font-sans">
            Split expenses with flatmates.{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Zero math.
            </span>{' '}
            Instant settlements.
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto font-medium">
            The modern financial ledger built for roommates, trips, and shared households.
            Track shared bills, calculate splits accurately down to the paisa, and settle debts directly with UPI.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button asChild size="lg" className="w-full sm:w-auto text-base font-semibold px-8 h-12 shadow-lg shadow-emerald-950/40">
              <Link to="/signup">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base font-semibold px-8 h-12">
              <Link to="/login">Sign In to Group</Link>
            </Button>
          </div>

          {/* Key Value Micro-Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              100% Free for groups
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Secure email verification
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Direct 1-tap UPI links
            </span>
          </div>
        </div>

        {/* Realistic Interactive UI Showcase / Hero Mockup */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="relative rounded-3xl p-3 sm:p-4 bg-[#111827]/70 border border-white/[0.08] shadow-2xl shadow-black/80 backdrop-blur-xl">
            <Card className="border border-white/[0.08] shadow-none overflow-hidden rounded-2xl bg-[#18181B]/95 text-slate-100">
              {/* Mock App Header */}
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#111827]/90">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
                    ₹
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">Apartment 402 — Monthly Ledger</h4>
                    <p className="text-[11px] text-slate-400 font-medium">4 Flatmates • Active Cycle</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="verified" className="text-[11px] py-0.5 px-2.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Up to Date
                  </Badge>
                </div>
              </div>

              {/* Mock Dashboard Metric Cards */}
              <CardContent className="p-5 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-xl bg-[#111827]/80 border border-white/[0.06]">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Total Group Spend
                    </span>
                    <span className="text-2xl font-extrabold text-white font-mono">₹48,250.00</span>
                    <span className="text-[11px] text-emerald-400 font-medium block mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      14 split transactions
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#111827]/80 border border-white/[0.06]">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Your Out-of-Pocket
                    </span>
                    <span className="text-2xl font-extrabold text-white font-mono">₹24,500.00</span>
                    <span className="text-[11px] text-slate-400 font-medium block mt-1">
                      Rent, WiFi, Groceries
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                      Your Net Balance
                    </span>
                    <span className="text-2xl font-extrabold text-emerald-400 font-mono">+₹4,250.00</span>
                    <span className="text-[11px] text-emerald-300 font-bold block mt-1">
                      You are owed across flatmates
                    </span>
                  </div>
                </div>

                {/* Person-Wise Live Debt Relationships */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span>Direct Pairwise Relationships</span>
                    <span>Action</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.08] bg-[#111827]/70 hover:border-emerald-500/30 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center justify-center">
                          AK
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Aarav Kumar</p>
                          <p className="text-xs text-emerald-400 font-semibold">Owes you ₹2,150.00 (Groceries split)</p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/25">
                        <QrCode className="h-3.5 w-3.5" />
                        <span>UPI Request Ready</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.08] bg-[#111827]/70 hover:border-emerald-500/30 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold text-xs flex items-center justify-center">
                          PS
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Priya Sharma</p>
                          <p className="text-xs text-emerald-400 font-semibold">Owes you ₹2,100.00 (Electricity bill)</p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/25">
                        <QrCode className="h-3.5 w-3.5" />
                        <span>UPI Request Ready</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.06] bg-[#111827]/40">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-800 text-slate-400 border border-white/[0.06] font-bold text-xs flex items-center justify-center">
                          VS
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-300">Vikram Singh</p>
                          <p className="text-xs text-slate-500 font-medium">All settled up • Zero balance</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium bg-[#1F2937] text-slate-300 border border-white/[0.06]">
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
