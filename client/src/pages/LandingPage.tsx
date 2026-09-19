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
    <div className="min-h-screen bg-white flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
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

