import React from 'react';
import { motion } from 'framer-motion';
import { QrCode, Bot, Users, Scale, Sparkles } from 'lucide-react';

export const FeatureCardsSection: React.FC = () => {
  const realFeatures = [
    {
      icon: <Users className="w-6 h-6 text-[#FF6B00]" />,
      title: '6-Digit Invites & QR Scanner',
      description: 'Create groups instantly. Invite flatmates with a 6-digit code or direct QR code scanner.',
      badge: 'Group Management',
    },
    {
      icon: <Scale className="w-6 h-6 text-[#FF6B00]" />,
      title: 'Equal & Custom Split Engine',
      description: 'Split bills equally among everyone or assign custom exact shares to specific group members.',
      badge: 'Flexible Splitting',
    },
    {
      icon: <QrCode className="w-6 h-6 text-[#FF6B00]" />,
      title: 'Native UPI & QR Settlements',
      description: 'Pay directly to receivers via integrated UPI IDs and auto-generated payment QR codes with 0 fees.',
      badge: '1-Tap UPI Payments',
    },
    {
      icon: <Bot className="w-6 h-6 text-[#FF6B00]" />,
      title: 'Gemini AI Financial Assistant',
      description: 'Ask questions about your balances and spending history in English, Hindi, or Hinglish.',
      badge: 'AI Powered',
    },
  ];

  return (
    <section id="features" className="py-16 bg-[#FFF8F2]">
      <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="text-center max-w-lg mx-auto mb-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built-In Capabilities</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
            Engineered for Real Shared Living
          </h2>
          <p className="text-xs sm:text-sm text-[#1E1E1E]/75 font-medium">
            Real features designed around actual group expense workflows.
          </p>
        </div>

        {/* 4 Real Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {realFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white/90 backdrop-blur-md rounded-[20px] p-6 border border-[#FF6B00]/20 shadow-sm hover:shadow-xl hover:border-[#FF6B00]/40 hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF8F2] border border-[#FF6B00]/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-[10px] font-extrabold border border-[#FF6B00]/20">
                    {feature.badge}
                  </span>
                </div>

                <h3 className="text-lg font-black text-[#1E1E1E] mb-2 font-sans tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#1E1E1E]/75 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
