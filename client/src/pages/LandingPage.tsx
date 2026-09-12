import React from 'react';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { HeroSection } from '../components/landing/HeroSection';
import { BuiltAndOwnedSection } from '../components/landing/BuiltAndOwnedSection';
import { FeatureCardsSection } from '../components/landing/FeatureCardsSection';
import { AIDemoSection } from '../components/landing/AIDemoSection';
import { AboutSection } from '../components/landing/AboutSection';
import { CTASection } from '../components/landing/CTASection';
import { LandingFooter } from '../components/landing/LandingFooter';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FFF8F2] text-[#1E1E1E] font-sans antialiased selection:bg-[#FF6B00] selection:text-white">
      <LandingNavbar />
      <main className="pt-14 sm:pt-16">
        <HeroSection />
        <BuiltAndOwnedSection />
        <FeatureCardsSection />
        <AIDemoSection />
        <AboutSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
