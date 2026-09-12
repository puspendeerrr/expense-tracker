import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Code2, ArrowUpRight, ArrowRight, ShieldCheck, Sparkles, UserCheck, Laptop } from 'lucide-react';

export const BuiltAndOwnedSection: React.FC = () => {
  return (
    <section className="py-16 bg-[#FFF8F2] relative overflow-hidden">
      <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Section Title Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-xl mx-auto mb-10 space-y-2"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] text-xs font-extrabold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Trust & Engineering</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
            Built by Industry Professionals
          </h2>
          <p className="text-xs sm:text-sm text-[#1E1E1E]/75 font-medium">
            Expense Tracker is an official product of Algorithmyum Software Solutions.
          </p>
        </motion.div>

        {/* Compact Glassmorphic Profile Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Company Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white/90 backdrop-blur-md rounded-[20px] p-6 border border-[#FF6B00]/20 shadow-sm hover:shadow-xl hover:border-[#FF6B00]/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8C42] text-white flex items-center justify-center shadow-md shadow-[#FF6B00]/20 group-hover:rotate-6 transition-transform duration-300">
                <Building2 className="w-5 h-5 stroke-[2.2]" />
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-[#FF6B00] uppercase tracking-wider block mb-1">
                  Product Owner
                </span>
                <h3 className="text-base font-extrabold text-[#1E1E1E] tracking-tight font-sans">
                  Algorithmyum Software Solutions
                </h3>
                <p className="text-xs text-[#FF6B00] font-bold mt-1">
                  Founder: Puspender Kumar
                </p>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  Building modern software for businesses.
                </p>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-100 mt-4">
              <a
                href="https://algorithyum.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] hover:text-[#FF8C42] transition-colors group/link"
              >
                <span>Visit Website</span>
                <ArrowUpRight className="w-4 h-4 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
              </a>
            </div>
          </motion.div>

          {/* Developer Card 1: Puspender Kumar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white/90 backdrop-blur-md rounded-[20px] p-6 border border-[#FF6B00]/20 shadow-sm hover:shadow-xl hover:border-[#FF6B00]/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-[#FF6B00] to-[#FF8C42] text-[#FF6B00] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                <img
                  src="/puspender-img.jpeg"
                  alt="Puspender Kumar"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-[#FF6B00] uppercase tracking-wider block mb-1">
                  Engineering Lead
                </span>
                <h3 className="text-base font-extrabold text-[#1E1E1E] tracking-tight font-sans">
                  Puspender Kumar
                </h3>
                <p className="text-xs text-slate-600 font-semibold mt-1">
                  Founder & Product Architect
                </p>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-100 mt-4 flex items-center justify-between">
              <a
                href="https://puspender.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E1E1E] hover:text-[#FF6B00] transition-colors group/link"
              >
                <span>Portfolio</span>
                <ArrowUpRight className="w-4 h-4 text-[#FF6B00] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
              </a>
              <Link
                to="/founder"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B00] hover:underline"
              >
                <span>Founder's Note</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>

          {/* Developer Card 2: Chaten Toor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-white/90 backdrop-blur-md rounded-[20px] p-6 border border-[#FF6B00]/20 shadow-sm hover:shadow-xl hover:border-[#FF6B00]/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-[#FF6B00] to-[#FF8C42] text-[#FF6B00] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                <img
                  src="/chaten-img.png"
                  alt="Chaten Toor"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-[#FF6B00] uppercase tracking-wider block mb-1">
                  Core Engineer
                </span>
                <h3 className="text-base font-extrabold text-[#1E1E1E] tracking-tight font-sans">
                  Chaten Toor
                </h3>
                <p className="text-xs text-slate-600 font-semibold mt-1">
                  Software Engineer
                </p>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-100 mt-4 flex items-center justify-between">
              <a
                href="https://chaten.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E1E1E] hover:text-[#FF6B00] transition-colors group/link"
              >
                <span>Portfolio</span>
                <ArrowUpRight className="w-4 h-4 text-[#FF6B00] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
              </a>
              <Link
                to="/developer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B00] hover:underline"
              >
                <span>Engineering Journal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
