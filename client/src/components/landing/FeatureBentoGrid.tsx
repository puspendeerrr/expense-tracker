import React from 'react';
import { motion } from 'framer-motion';
import { Receipt, QrCode, ShieldCheck, Bell, Search, Smartphone, Bot, TrendingDown } from 'lucide-react';
import { BentoGrid, BentoGridItem } from './ui/bento-grid';
import { SpotlightCard } from './ui/spotlight-card';

export const FeatureBentoGrid: React.FC = () => {
  const features = [
    {
      title: 'Flexible Expense Splitting',
      desc: 'Log any shared expense in seconds. Split equally among everyone or pick specific flatmates with custom share calculations.',
      badge: 'Core Engine',
      icon: <Receipt className="w-5 h-5 text-blue-400" />,
      header: (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between font-semibold">
            <span className="text-slate-200">Flat Rent (Sep)</span>
            <span className="text-blue-400 font-mono">₹12,000</span>
          </div>
          <div className="text-[11px] text-slate-400">Paid by Puspender • Split equally (₹3,000/person)</div>
        </div>
      ),
    },
    {
      title: 'Smart Debt Minimization',
      desc: 'Algorithmically resolves multi-person dues into minimum transactions. Say goodbye to complex round-robin money transfers.',
      badge: 'Graph Optimization',
      icon: <TrendingDown className="w-5 h-5 text-blue-400" />,
      header: (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-200">Simplified Settlement</div>
            <div className="text-[11px] text-blue-400 font-mono">Reduced from 6 transfers ➔ 2</div>
          </div>
          <div className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-semibold">
            Auto-Optimized
          </div>
        </div>
      ),
    },
    {
      title: 'SplitWise AI Financial Assistant',
      desc: 'Ask questions in Hinglish, English, or Hindi. Generative AI analyzes group spending, balance breakdowns, and expense trends.',
      badge: 'GenAI Powered',
      icon: <Bot className="w-5 h-5 text-blue-400" />,
      header: (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
          <div className="text-blue-400 font-semibold">"Bhai, kisne kitna spend kiya?"</div>
          <div className="text-[11px] text-slate-300">Puspender paid ₹14,400 (60%). You owe ₹450 total.</div>
        </div>
      ),
    },
    {
      title: 'Direct UPI & Custom QR Codes',
      desc: 'Add your UPI ID or upload PhonePe / GPay QR code. Flatmates scan & pay directly to your bank account with zero platform fees.',
      badge: 'Instant Pay',
      icon: <QrCode className="w-5 h-5 text-blue-400" />,
      header: (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-200">Puspender's UPI ID</div>
            <div className="text-[11px] text-blue-400 font-mono">puspender@upi</div>
          </div>
          <div className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-semibold">
            Scan & Pay
          </div>
        </div>
      ),
    },
    {
      title: 'Real-Time Socket Sync & Push Alerts',
      desc: 'Socket.io instantly syncs changes across flatmate screens. Web Push and Native Push alerts keep everyone informed instantly.',
      badge: 'Instant Sync',
      icon: <Bell className="w-5 h-5 text-blue-400" />,
      header: (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
          <div className="text-blue-400 font-semibold flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Sarthak added ₹4,850 Groceries bill
          </div>
          <div className="text-[10px] text-slate-400">Live push notification broadcasted</div>
        </div>
      ),
    },
    {
      title: 'Inspector Audit & Multi-Device APK',
      desc: 'Read-only Inspector console for global audit access. Access on desktop, mobile web, or standalone Android APK.',
      badge: 'Cross Platform',
      icon: <Smartphone className="w-5 h-5 text-blue-400" />,
      header: (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
          <span className="font-semibold text-slate-200">Android App + Web Console</span>
          <span className="text-blue-400 font-mono text-[10px]">Read-Only Inspector Ready</span>
        </div>
      ),
    },
  ];

  return (
    <section id="features" className="py-24 bg-slate-950 text-white relative border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 inline-block backdrop-blur-md">
            Aceternity Bento Capabilities
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight font-sans text-white">
            Designed like an Apple product. Engineered for real life.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Every detail crafted for lightning performance, transparent audits, and friction-free bill splitting.
          </p>
        </div>

        {/* Aceternity Bento Grid */}
        <BentoGrid className="max-w-7xl">
          {features.map((feat, idx) => (
            <BentoGridItem
              key={idx}
              title={feat.title}
              description={feat.desc}
              badge={feat.badge}
              icon={feat.icon}
              header={feat.header}
            />
          ))}
        </BentoGrid>
      </div>
    </section>
  );
};
