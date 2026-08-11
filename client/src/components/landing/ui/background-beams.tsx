import React from 'react';
import { motion } from 'framer-motion';

export const BackgroundBeams: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Background Radial Glow (Apple Blue Palette) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-600/12 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.5) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Animated Floating Light Beams */}
      <motion.div
        animate={{
          opacity: [0.35, 0.65, 0.35],
          scale: [1, 1.12, 1],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-40 -left-20 w-[750px] h-[750px] bg-gradient-to-tr from-blue-600/25 via-indigo-500/15 to-transparent rounded-full blur-3xl pointer-events-none"
      />

      <motion.div
        animate={{
          opacity: [0.25, 0.55, 0.25],
          scale: [1, 1.18, 1],
          rotate: [0, -6, 0],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute top-1/2 -right-40 w-[700px] h-[700px] bg-gradient-to-br from-sky-600/20 via-blue-600/15 to-transparent rounded-full blur-3xl pointer-events-none"
      />
    </div>
  );
};
