import React from 'react';
import { motion } from 'framer-motion';

export const ButtonWithMovingBorder: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  containerClassName?: string;
  as?: React.ElementType;
  [key: string]: any;
}> = ({
  children,
  onClick,
  className = '',
  containerClassName = '',
  as: Component = 'button',
  ...props
}) => {
  return (
    <Component
      onClick={onClick}
      className={`relative p-[1.5px] overflow-hidden rounded-xl inline-flex items-center justify-center font-semibold transition-transform active:scale-95 ${containerClassName}`}
      {...props}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-500 rounded-xl"
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          width: '200%',
          height: '200%',
          top: '-50%',
          left: '-50%',
        }}
      />
      <div
        className={`relative z-10 w-full h-full bg-slate-950 text-white rounded-[10px] px-6 py-3.5 flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors ${className}`}
      >
        {children}
      </div>
    </Component>
  );
};
