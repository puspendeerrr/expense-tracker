import React from 'react';
import { cn } from '../../../utils/cn';

export const BentoGrid: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({ className, children }) => {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-3 gap-5 max-w-7xl mx-auto',
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem: React.FC<{
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
}> = ({ className, title, description, header, icon, badge }) => {
  return (
    <div
      className={cn(
        'row-span-1 rounded-2xl group/bento hover:shadow-xl transition duration-200 shadow-input dark:shadow-none p-5 bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between space-y-4 hover:border-emerald-500/50 hover:bg-slate-900/90 relative overflow-hidden backdrop-blur-md',
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-1 transition duration-200">
        {badge && (
          <span className="inline-block px-2.5 py-0.5 mb-2 text-[10px] uppercase font-bold tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {badge}
          </span>
        )}
        <div className="flex items-center gap-2 mb-1.5">
          {icon && <div className="text-emerald-400">{icon}</div>}
          <h3 className="font-sans font-bold text-slate-100 text-lg">
            {title}
          </h3>
        </div>
        <p className="font-sans font-normal text-slate-400 text-xs leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};
