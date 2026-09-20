import React from 'react';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingWorkflow } from '@/components/landing/LandingWorkflow';
import { LandingSecurity } from '@/components/landing/LandingSecurity';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingFooter } from '@/components/landing/LandingFooter';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300 relative overflow-x-hidden">
      {/* Subtle branded background watermark — fixed, strictly only on marketing landing page */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden select-none"
        aria-hidden="true"
      >
        <img
          src="/SplitMoney%20only%20logo.svg"
          alt=""
          className="w-[85vw] max-w-[420px] sm:w-[80vw] sm:max-w-[650px] md:w-[75vw] md:max-w-[850px] lg:w-[72vw] lg:max-w-[1050px] xl:w-[68vw] xl:max-w-[1150px] aspect-square object-contain pointer-events-none"
          style={{ opacity: 0.03 }}
          loading="eager"
          decoding="async"
        />
      </div>

      {/* Global subtle ambient background glow */}
      <div className="fixed -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.06)_0%,rgba(2,105,252,0.04)_40%,transparent_70%)] pointer-events-none -z-10" />
      <LandingNavbar />
      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingWorkflow />
        <LandingSecurity />
        <LandingFAQ />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;

