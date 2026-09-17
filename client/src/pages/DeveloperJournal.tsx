import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Code2,
  Cpu,
  Layers,
  FolderTree,
  GitBranch,
  CheckCircle2,
  Terminal,
  Zap,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Server,
  Database,
  Smartphone,
  ShieldCheck,
  ArrowUpRight,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
} from 'lucide-react';


export const DeveloperJournal: React.FC = () => {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    client: true,
    server: true,
  });

  const toggleFolder = (folderKey: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  const techStack = [
    {
      name: 'React 18 & TypeScript',
      category: 'Frontend Core',
      desc: 'Component-driven UI architecture with strong static typing and strict safety.',
    },
    {
      name: 'Vite & Tailwind CSS',
      category: 'Build Tooling & Styling',
      desc: 'Instant HMR development, modern utility styling, and lightning-fast production bundling.',
    },
    {
      name: 'Node.js & Express',
      category: 'Backend REST API',
      desc: 'Scalable asynchronous event loop server handling group management and settlement APIs.',
    },
    {
      name: 'MongoDB & Mongoose',
      category: 'Database System',
      desc: 'Document schema models for users, groups, expenses, activity logs, and settlements.',
    },
    {
      name: 'Socket.io',
      category: 'Real-Time WebSockets',
      desc: 'Bi-directional real-time WebSocket protocol for live balance and settlement updates.',
    },
    {
      name: 'Capacitor Android Native',
      category: 'Mobile Engine',
      desc: 'Cross-platform native Android APK bridge with automated live Over-The-Air bundle updates.',
    },
  ];

  const appWorkflow = [
    { step: '1. Authentication & JWT Token', detail: 'Secure bcrypt password hashing and 7-day JWT bearer tokens.' },
    { step: '2. Group Creation & Invite Engine', detail: 'Generate 6-digit alphanumeric invite codes and QR join tokens.' },
    { step: '3. Expense Logging & Splitting', detail: 'Equal ("everyone") or Custom ("specific") share allocation per member.' },
    { step: '4. Pairwise Debt Matrix Calculation', detail: 'Dynamic matrix netting algorithm computing exact pairwise obligations.' },
    { step: '5. 1-Tap UPI QR Settlement Engine', detail: 'Generates receiver UPI payment QR codes and logs verified receipts.' },
    { step: '6. Settlement History & PDF Exports', detail: 'Immutable transaction logs with downloadable settlement summaries.' },
  ];

  const engineeringChallenges = [
    {
      title: 'Real-Time State Synchronization',
      desc: 'Ensuring that when one user adds an expense, all connected group members receive instant balance updates over WebSockets without manual refreshes.',
    },
    {
      title: 'Pairwise Debt Matrix Optimization',
      desc: 'Calculating complex multi-user debts dynamically while maintaining individual obligation history instead of forcing destructive netting.',
    },
    {
      title: 'Capacitor Live OTA Updates',
      desc: 'Implementing an automated live bundle updater in Capacitor to deliver instant Web updates directly to Android APK users without Play Store delays.',
    },
    {
      title: 'Cross-Device Responsiveness',
      desc: 'Designing layout Math and CSS boundaries so modals, drawer menus, and data tables look pristine across small phone screens and wide 4K displays.',
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
                <Code2 className="w-3.5 h-3.5" />
                <span>Engineering Journal & Architecture</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-[#1E1E1E] tracking-tight font-sans">
                Engineering Journal
              </h1>

              <p className="text-sm sm:text-base text-[#1E1E1E]/80 font-medium leading-relaxed italic">
                "Building reliable software requires thoughtful engineering, not just writing code."
              </p>

              <div className="pt-1 text-xs font-semibold text-slate-500">
                <span>Written By </span>
                <span className="text-[#1E1E1E] font-extrabold">Chaten Toor</span>
                <span className="block text-[11px] text-[#FF6B00] font-semibold mt-0.5">
                  Software Engineer • SplitWise Pro Team
                </span>
              </div>

              {/* Scroll Prompt */}
              <div className="pt-2 hidden lg:block">
                <a
                  href="#architecture"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF6B00] hover:text-[#FF8C42] transition-colors"
                >
                  <span>Explore System Architecture</span>
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
                    src="/chaten-img.png"
                    alt="Chaten Toor"
                    className="w-full h-full object-cover object-center rounded-full"
                  />
                </div>

                {/* Name & Role */}
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-[#1E1E1E] tracking-tight font-sans">
                    Chaten Toor
                  </h3>
                  <p className="text-xs text-[#FF6B00] font-bold mt-0.5">
                    Software Engineer
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    SplitWise Pro Engineering Team
                  </p>
                </div>

                {/* 1-2 Lines Text */}
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed max-w-xs mx-auto">
                  "Focused on building scalable, maintainable, and high-performance software systems."
                </p>

                {/* Compact Action Button */}
                <div className="pt-2 border-t border-slate-100">
                  <a
                    href="https://chaten.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-8.5 px-3 rounded-lg bg-gradient-to-r from-[#FF6B00] to-[#FF8C42] text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm hover:opacity-95 transition-opacity"
                  >
                    <span>View Portfolio</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: System Architecture Overview */}
          <section id="architecture" className="space-y-6 scroll-mt-28">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>Section 01</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              System Architecture & Overview
            </h2>

            <div className="prose prose-slate max-w-none text-sm sm:text-base text-[#1E1E1E]/85 leading-relaxed space-y-4 font-medium">
              <p>
                The SplitWise Pro architecture is built around a modern full-stack JavaScript engine designed for high-concurrency real-time balance calculations.
              </p>
              <p>
                The frontend is constructed using React 18, Vite, TypeScript, and Tailwind CSS, structured into modular pages, context providers (`AuthContext`, `SocketContext`), and reusable Ant Design components.
              </p>
              <p>
                The backend is powered by Node.js and Express REST APIs, backed by MongoDB Mongoose schemas for data persistence and Socket.io for real-time WebSocket event broadcasting.
              </p>
            </div>
          </section>

          {/* SECTION 2: Technology Stack */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Section 02</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              The Technology Stack
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {techStack.map((tech, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-[#FF6B00]/15 shadow-sm space-y-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#FFF8F2] border border-[#FF6B00]/25 text-[#FF6B00] font-bold text-[10px]">
                    {tech.category}
                  </span>
                  <h3 className="font-extrabold text-sm text-[#1E1E1E] font-sans">{tech.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{tech.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3: Folder Structure Tree */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <FolderTree className="w-4 h-4" />
              <span>Section 03</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              Application Code Base Structure
            </h2>

            <div className="bg-slate-900 text-slate-200 rounded-3xl p-6 border border-slate-800 shadow-xl font-mono text-xs space-y-3">
              {/* Folder Client */}
              <div>
                <button
                  onClick={() => toggleFolder('client')}
                  className="flex items-center gap-2 text-orange-400 font-bold hover:text-orange-300"
                >
                  {openFolders.client ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Folder className="w-4 h-4" />
                  <span>client/src</span>
                </button>
                {openFolders.client && (
                  <div className="pl-6 pt-2 space-y-1.5 text-slate-400 border-l border-slate-800 ml-2">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-orange-400" />
                      <span>components/landing/</span> — Hero, Features, About, Footer
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-orange-400" />
                      <span>components/modals/</span> — SettlementModal, AddExpenseModal, QRScanner
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-orange-400" />
                      <span>context/</span> — AuthContext, SocketContext, NotificationContext
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-orange-400" />
                      <span>pages/</span> — Dashboard, Expenses, Members, Profile, History, Founder
                    </div>
                  </div>
                )}
              </div>

              {/* Folder Server */}
              <div className="pt-2">
                <button
                  onClick={() => toggleFolder('server')}
                  className="flex items-center gap-2 text-emerald-400 font-bold hover:text-emerald-300"
                >
                  {openFolders.server ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Folder className="w-4 h-4" />
                  <span>server/src</span>
                </button>
                {openFolders.server && (
                  <div className="pl-6 pt-2 space-y-1.5 text-slate-400 border-l border-slate-800 ml-2">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>models/</span> — User.js, Group.js, Expense.js, Settlement.js
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>utils/balance.js</span> — Pairwise debt graph calculation engine
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>socket/</span> — Real-time WebSocket event broadcaster
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 4: Application Workflow Flowchart */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <GitBranch className="w-4 h-4" />
              <span>Section 04</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              End-to-End Application Workflow
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {appWorkflow.map((item, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 border border-[#FF6B00]/15 shadow-sm space-y-1">
                  <h3 className="font-extrabold text-xs text-[#FF6B00] uppercase tracking-wider font-sans">
                    {item.step}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5: Expense Calculation Logic */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              <span>Section 05</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              Expense Calculation & Balance Engine Logic
            </h2>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FF6B00]/20 shadow-lg space-y-4">
              <p className="text-sm text-[#1E1E1E]/85 leading-relaxed font-medium">
                The balance calculation algorithm in <code>server/utils/balance.js</code> populates a dynamic 2D debt graph matrix:
              </p>

              <div className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto">
                <pre>{`// Pairwise Debt Accumulation Logic
expenses.forEach(exp => {
  const payerId = exp.paidBy.toString();
  exp.splitDetails.forEach(detail => {
    const beneficiaryId = detail.user.toString();
    if (beneficiaryId !== payerId) {
      debtGraph[beneficiaryId][payerId] += detail.share;
    }
  });
});`}</pre>
              </div>

              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Settlements subtract directly from the debt graph matrix, guaranteeing that completed payments clear exact obligations without altering historical transaction records.
              </p>
            </div>
          </section>

          {/* SECTION 6: Engineering Challenges */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#FF6B00] font-extrabold text-xs uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>Section 06</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E] tracking-tight font-sans">
              Real Engineering Challenges Solved
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {engineeringChallenges.map((c, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-[#FF6B00]/15 shadow-sm space-y-2">
                  <h3 className="font-extrabold text-sm text-[#1E1E1E] font-sans flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CLOSING */}
          <div className="pt-12 border-t border-[#FF6B00]/20 space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-[#FF6B00]/20 shadow-xl space-y-4">
              <h3 className="text-lg font-extrabold text-[#1E1E1E] font-sans">Continuous Engineering Commitment</h3>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                We believe that software engineering is a process of continuous improvement. We will continue optimizing performance, data structures, and user experience for all SplitWise Pro users.
              </p>

              <div className="pt-4 border-t border-slate-100 font-medium text-xs space-y-1">
                <p className="font-black text-sm text-[#1E1E1E] font-sans">— Chaten Toor</p>
                <p className="text-slate-500 font-semibold">Software Engineer • SplitWise Pro Engineering Team</p>
                <div className="pt-2 flex items-center gap-4 text-[#FF6B00] font-bold">
                  <a href="https://chaten.in" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                    Engineering Portfolio <ArrowUpRight className="w-3.5 h-3.5" />
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

export default DeveloperJournal;
