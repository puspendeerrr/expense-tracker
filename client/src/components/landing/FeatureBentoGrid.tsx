import React from 'react';
import { motion } from 'framer-motion';
import { Receipt, QrCode, ShieldCheck, Bell, Search, Smartphone } from 'lucide-react';

export const FeatureBentoGrid: React.FC = () => {
  const features = [
    {
      title: 'Flexible Expense Splitting',
      desc: 'Log any shared expense in seconds. Split equally among everyone or pick specific flatmates with custom share calculations.',
      badge: 'Core Feature',
      icon: <Receipt className="w-5 h-5 text-emerald-600" />,
      preview: (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-2">
          <div className="flex justify-between font-bold">
            <span>House Rent (Sep)</span>
            <span className="text-emerald-400 font-mono">₹12,000</span>
          </div>
          <div className="text-[11px] text-slate-400">Paid by Puspender • Split equally (₹3,000/person)</div>
        </div>
      ),
    },
    {
      title: 'Direct UPI & Custom QR Codes',
      desc: 'Add your UPI ID or upload your PhonePe / GPay QR code. Flatmates scan & pay directly to your bank account.',
      badge: 'Instant Pay',
      icon: <QrCode className="w-5 h-5 text-emerald-600" />,
      preview: (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs flex items-center justify-between">
          <div>
            <div className="font-bold">Puspender's UPI</div>
            <div className="text-[11px] text-emerald-400 font-mono">puspender@upi</div>
          </div>
          <div className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold">
            Scan QR Code
          </div>
        </div>
      ),
    },
    {
      title: 'Payment Proof & Verification Workflow',
      desc: 'Upload Cloudinary bill receipts or UPI payment screenshots. Receivers review proof and verify settlements with zero disputes.',
      badge: 'Trust & Verification',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
      preview: (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">Aman → Puspender</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">Pending Approval</span>
          </div>
          <div className="text-[11px] text-slate-400">Payment proof screenshot attached ✓</div>
        </div>
      ),
    },
    {
      title: 'Real-Time Sync & Notifications',
      desc: 'Socket.io instantly syncs changes across all flatmates\' phones. Web Push and Native Push alerts notify when expenses or settlements are added.',
      badge: 'Instant Sync',
      icon: <Bell className="w-5 h-5 text-emerald-600" />,
      preview: (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-1.5">
          <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Sarthak added ₹4,850 Groceries expense
          </div>
          <div className="text-[10px] text-slate-400">Alert sent to all 4 flatmates</div>
        </div>
      ),
    },
    {
      title: 'Searchable History & Categories',
      desc: 'Filter group expenses by date, category (Rent, Food, Utilities, Travel), or member name. Never ask "ye expense kab hua tha?" again.',
      badge: 'Complete Audit',
      icon: <Search className="w-5 h-5 text-emerald-600" />,
      preview: (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-1">
          <div className="text-slate-300 font-medium">Filter: Category = Rent • Status = Active</div>
          <div className="text-[10px] text-slate-400 font-mono">4 total records found for 2026</div>
        </div>
      ),
    },
    {
      title: 'Works on Android & Web',
      desc: 'Access your group\'s hisaab on any laptop, tablet, or smartphone browser, or install the lightweight native Android app.',
      badge: 'Cross Platform',
      icon: <Smartphone className="w-5 h-5 text-emerald-600" />,
      preview: (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs flex items-center justify-between">
          <span className="font-bold">Android APK + Web PWA</span>
          <span className="text-emerald-400 font-mono text-[10px]">100% Offline Ready</span>
        </div>
      ),
    },
  ];

  return (
    <section id="features" className="py-20 bg-white text-slate-900 border-b border-slate-200 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 inline-block">
            Product Capabilities
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans text-slate-900">
            Everything your group needs to keep the hisaab clear.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Engineered specifically for shared living in India — fast, transparent, and completely automated.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 hover:shadow-lg transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {feat.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 font-sans mb-2">{feat.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{feat.desc}</p>
              </div>

              <div>{feat.preview}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
