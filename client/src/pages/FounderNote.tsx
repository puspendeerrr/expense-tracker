import {
  ArrowDown,
  ArrowUpRight,
  Building2,
  Compass,
  ExternalLink,
  Layers,
  Lightbulb,
  MessageSquareX,
  Sparkles,
  Target,
  Zap
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

export const FounderNote: React.FC = () => {
  const problems = [
    {
      title: 'Forgotten Payments',
      desc: 'During group trips or shared flat living, people frequently forget who paid for what after a few days, leading to lost money or confusion.',
    },
    {
      title: 'Scattered Receipts & Chats',
      desc: 'Bills get posted in random WhatsApp chats, screenshots get buried in photo galleries, and tracking history becomes impossible.',
    },
    {
      title: 'Manual Math & Calculation Errors',
      desc: 'Trying to split complex multi-person bills manually in notebooks or spreadsheets almost always leads to math errors and disagreement.',
    },
    {
      title: 'Social Awkwardness',
      desc: 'Nobody enjoys repeatedly messaging friends to ask for money. Awkward financial conversations damage friendships and room relationships.',
    },
    {
      title: 'Multi-Person Debt Complexity',
      desc: 'When Rahul pays for dinner, Priya pays for the cab, and Aman pays for rent, calculating net pairwise debt manually becomes a nightmare.',
    },
    {
      title: 'Lack of Settlement Transparency',
      desc: 'Without verified payment proofs or digital receipt records, members remain uncertain whether a debt was actually settled.',
    },
  ];

  const solverTimeline = [
    {
      stage: 'Problem Observation',
      subtitle: 'Identifying Human Friction',
      desc: 'Observed how roommates and trip groups struggled with bill splitting, leading to awkward financial reminders and spreadsheets.',
    },
    {
      stage: 'User Research',
      subtitle: 'Studying Behavior Patterns',
      desc: 'Interviewed flatmates, hostel students, and vacation groups to understand why existing tools felt overly complex or unintuitive.',
    },
    {
      stage: 'Architectural Planning',
      subtitle: 'Designing the Net Debt Engine',
      desc: 'Designed a real-time pairwise balance algorithm to automatically minimize total group payments down to single direct transfers.',
    },
    {
      stage: 'UX & Visual Design',
      subtitle: 'Focusing on 3-Second Clarity',
      desc: 'Crafted a clean, mobile-first interface centered around 1-tap UPI QR settlements and 6-digit group code sharing.',
    },
    {
      stage: 'Engineering & Integration',
      subtitle: 'Building Scalable Full-Stack Core',
      desc: 'Developed real-time WebSocket sync, Capacitor Android native shell, and Google Gemini AI financial assistant integration.',
    },
    {
      stage: 'Rigorous Testing',
      subtitle: 'Edge-Case Verification',
      desc: 'Tested complex multi-split edge cases, partial settlements, invite token joins, and automated live updates.',
    },
    {
      stage: 'Production Product',
      subtitle: 'SplitWise Pro Ecosystem',
      desc: 'Deployed an official, production-ready product under the Algorithmyum Software Solutions ecosystem.',
    },
  ];

  const designPrinciples = [
    {
      title: 'Simple',
      desc: 'Interfaces should explain themselves within 3 seconds. Zero training or spreadsheet knowledge required.',
    },
    {
      title: 'Fast',
      desc: 'Optimized bundle sizes, instant client state updates, and 1-tap QR settlements for maximum speed.',
    },
    {
      title: 'Reliable',
      desc: 'Deterministic debt graph algorithms ensure exact math to the last cent without balance drift.',
    },
    {
      title: 'Transparent',
      desc: 'Every expense, split percentage, and settlement proof is visible to all group members in real time.',
    },
    {
      title: 'Accessible',
      desc: 'Fully responsive across mobile phones, tablets, desktop displays, and Android native devices.',
    },
    {
      title: 'Modern',
      desc: 'Premium glassmorphism, crisp typography, clean micro-interactions, and AI-assisted intelligence.',
    },
  ];

  const futureRoadmap = [
    {
      title: 'Google Gemini AI Financial Insights',
      desc: 'Natural language queries in English, Hindi, and Hinglish for smart expense analytics.',
    },
    {
      title: 'Automatic OCR Receipt Scanner',
      desc: 'Scan paper restaurant receipts and automatically extract line items and splits.',
    },
    {
      title: 'Direct Banking & UPI Deep Links',
      desc: '1-tap auto-redirection into GPay, PhonePe, and Paytm with pre-filled payment amounts.',
    },
    {
      title: 'Automated Recurring Expense Schedules',
      desc: 'Set recurring monthly rent, Wi-Fi bills, and maid salaries to auto-log every month.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFF8F2] text-[#1E1E1E] font-sans antialiased selection:bg-[#FF6B00] selection:text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FFF8F2]/90 backdrop-blur-md border-b border-[#FF6B00]/15 px-4 sm:px-8 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 text-decoration-none">
          <img src="/favicon.svg" alt="Splitwise Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="font-extrabold text-base text-[#1E1E1E]">Splitwise Pro</span>
        </Link>
        <Link to="/dashboard" className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white font-bold text-xs shadow-sm hover:opacity-90 transition-opacity">
          Open App
        </Link>
      </header>

      <main className="pt-20 sm:pt-24 pb-16">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-[1536px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-12">
          {/* HERO SECTION - Compact 2-Column Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center border-b border-[#FF6B00]/15 pb-8">
            {/* Left Column: Title & Subtitle */}
            <div className="lg:col-span-7 space-y-3 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/25 text-[#FF6B00] text-[11px] font-extrabold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Founder's Note & Product Story</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-[#1E1E1E] tracking-tight font-sans">
                From the Founder
              </h1>

              <p className="text-sm sm:text-base text-[#1E1E1E]/80 font-medium leading-relaxed italic">
                "Every meaningful product begins with a real human problem."
              </p>

              <div className="pt-1 text-xs font-semibold text-slate-500">
                <span>By </span>
                <span className="text-[#1E1E1E] font-extrabold">Puspender Kumar</span>
                <span className="block text-[11px] text-[#FF6B00] font-semibold mt-0.5">
                  Founder & Product Architect • Algorithmyum Software Solutions
                </span>
              </div>

              {/* Scroll Prompt */}
              <div className="pt-2 hidden lg:block">
                <a
                  href="#story"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF6B00] hover:text-[#FF8C42] transition-colors"
                >
                  <span>Read Full Founder's Story</span>
                  <ArrowDown className="w-3.5 h-3.5 animate-bounce stroke-[2.5]" />
                </a>
              </div>
            </div>

            {/* Right Column: Sleek Compact Profile Card */}
            <div className="lg:col-span-5">
              <div className="bg-white/95 rounded-2xl p-4.5 sm:p-5 border border-[#FF6B00]/20 shadow-lg shadow-[#FF6B00]/5 backdrop-blur-md space-y-3 text-center hover:border-[#FF6B00]/40 transition-all">
                {/* Profile Photo - Compact Avatar */}
                <div className="w-20 h-20 sm:w-22 sm:h-22 mx-auto rounded-full p-0.5 bg-gradient-to-tr from-[#FF6B00] via-[#FF8C42] to-amber-400 shadow-md shadow-[#FF6B00]/15 shrink-0 overflow-hidden">
                  <img
                    src="/puspender-img.jpeg"
                    alt="Puspender Kumar"
                    className="w-full h-full object-cover object-center rounded-full"
                  />
                </div>

                {/* Name & Role */}
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-[#1E1E1E] tracking-tight font-sans">
                    Puspender Kumar
                  </h3>
                  <p className="text-xs text-[#FF6B00] font-bold mt-0.5">
                    Founder & Product Architect
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    Algorithmyum Software Solutions
                  </p>
                </div>

                {/* 1-2 Lines Text */}
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed max-w-xs mx-auto">
                  "Passionate about solving real-world problems through thoughtful software. Building simple, scalable products."
                </p>

                {/* Compact Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2">
                  <a
                    href="https://puspender.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-8.5 px-3 rounded-lg bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm hover:opacity-95 transition-opacity"
                  >
                    <span>Portfolio</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href="https://algorithyum.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-8.5 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[#1E1E1E] font-bold text-xs flex items-center justify-center gap-1 hover:border-[#FF6B00]/40 hover:text-[#FF6B00] transition-colors"
                  >
                    <span>Algorithmyum</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#FF6B00]" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: The Story Behind Expense Tracker */}
          <section id="story" className="space-y-6 scroll-mt-28">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Lightbulb className="w-4 h-4" />
              <span>Section 01</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              The Story Behind Expense Tracker
            </h2>

            <div className="prose prose-slate max-w-none text-sm sm:text-base text-[#1E1E1E]/85 leading-relaxed space-y-4 font-medium">
              <p>
                Expense Tracker wasn't born in a corporate boardroom or created as a random coding exercise. It started from personal observation during shared room living and group trips with friends.
              </p>
              <p>
                Whenever friends live together in flatshares, travel on vacation trips, or organize group events, managing shared finances inevitably becomes messy. Someone pays for dinner, someone else covers the rental cab, and another person buys groceries. Within a few days, nobody remembers who paid what.
              </p>
              <p>
                People usually resorted to chaotic WhatsApp group chats, handwritten notebook pages, or complex Excel spreadsheets. But manual spreadsheets create calculation mistakes, and WhatsApp messages get buried under hundreds of daily texts.
              </p>
              <div className="p-5 rounded-2xl bg-white border-l-4 border-[#FF6B00] shadow-sm italic text-slate-800 text-sm">
                "This wasn't just about tracking money—it was about eliminating friction from human relationships. Nobody enjoys awkwardly messaging friends to ask for unpaid debts."
              </div>
              <p>
                We built Expense Tracker to solve this exact problem. By automating pairwise debt calculations and enabling 1-tap UPI QR payments, we removed financial friction so groups can focus on enjoying their experiences together.
              </p>
            </div>
          </section>

          {/* SECTION 2: The Real Problem */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <MessageSquareX className="w-4 h-4" />
              <span>Section 02</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              The Real Friction in Shared Living
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {problems.map((p, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-5 border border-[#FF6B00]/15 shadow-sm space-y-2 hover:border-[#FF6B00]/40 transition-colors"
                >
                  <h3 className="font-extrabold text-sm text-[#1E1E1E] flex items-center gap-2 font-sans">
                    <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                    {p.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3: Our Philosophy */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Target className="w-4 h-4" />
              <span>Section 03</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              Our Product Philosophy at Algorithmyum
            </h2>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FF6B00]/20 shadow-lg shadow-[#FF6B00]/5 space-y-4">
              <p className="text-sm sm:text-base text-[#1E1E1E]/85 leading-relaxed font-medium">
                At <strong>Algorithmyum Software Solutions</strong>, we do not build software simply to complete projects or check off feature lists. Every product we design starts with observing human behavior and identifying real pain points.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#FFF8F2] border border-[#FF6B00]/20 space-y-1">
                  <h4 className="font-bold text-xs text-[#1E1E1E]">1. Problem First, Code Second</h4>
                  <p className="text-xs text-slate-600">We deeply study human behavior before writing a single line of frontend or backend code.</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFF8F2] border border-[#FF6B00]/20 space-y-1">
                  <h4 className="font-bold text-xs text-[#1E1E1E]">2. Invisible Technology</h4>
                  <p className="text-xs text-slate-600">Great software disappears behind an intuitive user interface that anyone can understand instantly.</p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: How We Solved It (Timeline) */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Compass className="w-4 h-4" />
              <span>Section 04</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              How We Built the Solution
            </h2>

            <div className="space-y-4 relative pl-6 border-l-2 border-[#FF6B00]/30 ml-2">
              {solverTimeline.map((item, idx) => (
                <div key={idx} className="relative space-y-1">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[#FF6B00] border-4 border-white shadow-sm" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B00]">
                    {item.stage}
                  </span>
                  <h3 className="text-sm font-bold text-[#1E1E1E] font-sans">{item.subtitle}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5: Design Principles */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Section 05</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              Our 6 Core Design Principles
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {designPrinciples.map((p, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-[#FF6B00]/15 shadow-sm space-y-2">
                  <span className="w-7 h-7 rounded-xl bg-[#FFF8F2] border border-[#FF6B00]/25 text-[#FF6B00] font-bold text-xs flex items-center justify-center">
                    0{idx + 1}
                  </span>
                  <h3 className="font-extrabold text-sm text-[#1E1E1E] font-sans">{p.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 6: About Algorithmyum */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Section 06</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              About Algorithmyum Software Solutions
            </h2>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FF6B00]/20 shadow-lg space-y-4">
              <p className="text-sm text-[#1E1E1E]/85 leading-relaxed font-medium">
                Algorithmyum Software Solutions is a modern software house focused on building scalable, human-centric web applications, mobile platforms, and AI systems.
              </p>
              <div className="pt-2">
                <a
                  href="https://algorithyum.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] text-white font-bold text-xs shadow-md shadow-[#FF6B00]/20 hover:opacity-95 transition-opacity"
                >
                  <span>Explore Algorithmyum Software Solutions</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </section>

          {/* SECTION 7: Future Vision */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>Section 07</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              The Future Roadmap of SplitWise Pro
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {futureRoadmap.map((r, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-[#FF6B00]/15 shadow-sm space-y-1.5">
                  <h3 className="font-extrabold text-xs text-[#FF6B00] uppercase tracking-wider font-sans">
                    {r.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CLOSING LETTER */}
          <div className="pt-12 border-t border-[#FF6B00]/20 space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-[#FF6B00]/20 shadow-xl space-y-4">
              <h3 className="text-lg font-extrabold text-[#1E1E1E] font-sans">Thank You for Using Expense Tracker</h3>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                We are committed to continuously refining this platform based on user feedback. Thank you to all our users, flatmates, and engineering contributors who helped bring this vision to life.
              </p>

              <div className="pt-4 border-t border-slate-100 font-medium text-xs space-y-1">
                <p className="font-black text-sm text-[#1E1E1E] font-sans">— Puspender Kumar</p>
                <p className="text-slate-500 font-semibold">Founder & Product Architect • Algorithmyum Software Solutions</p>
                <div className="pt-2 flex items-center gap-4 text-[#FF6B00] font-bold">
                  <a href="https://puspender.in" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                    Portfolio <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                  <a href="https://algorithyum.in" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                    Company <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#FF6B00]/15 bg-[#FFF8F2] py-8 text-center text-xs text-slate-500 font-medium">
        <p>© {new Date().getFullYear()} Splitwise Pro • Algorithmyum Software Solutions</p>
      </footer>
    </div>
  );
};

export default FounderNote;
