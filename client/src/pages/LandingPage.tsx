import React from 'react';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { HeroSection } from '../components/landing/HeroSection';
import { ProblemSection } from '../components/landing/ProblemSection';
import { SolutionTimeline } from '../components/landing/SolutionTimeline';
import { AudienceSection } from '../components/landing/AudienceSection';
import { DebtMinimizationDemo } from '../components/landing/DebtMinimizationDemo';
import { AIDemoSection } from '../components/landing/AIDemoSection';
import { FeatureBentoGrid } from '../components/landing/FeatureBentoGrid';
import { CalculatorDemo } from '../components/landing/CalculatorDemo';
import { BeforeAfterSection } from '../components/landing/BeforeAfterSection';
import { FAQSection } from '../components/landing/FAQSection';
import { CTASection } from '../components/landing/CTASection';
import { LandingFooter } from '../components/landing/LandingFooter';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white antialiased">
      <LandingNavbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionTimeline />
        <AudienceSection />
        <DebtMinimizationDemo />
        <AIDemoSection />
        <FeatureBentoGrid />
        <CalculatorDemo />
        <BeforeAfterSection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
