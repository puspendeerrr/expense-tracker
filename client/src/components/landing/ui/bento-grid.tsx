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
        'row-span-1 rounded-2xl group/bento hover:shadow-2xl hover:shadow-blue-500/10 transition duration-300 p-6 bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between space-y-4 hover:border-blue-500/50 hover:bg-slate-900/95 relative overflow-hidden backdrop-blur-md',
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-1 transition duration-200">
        {badge && (
          <span className="inline-block px-3 py-1 mb-3 text-[10px] uppercase font-semibold tracking-wider rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {badge}
          </span>
        )}
        <div className="flex items-center gap-2 mb-2">
          {icon && <div className="text-blue-400 text-xl">{icon}</div>}
          <h3 className="font-sans font-semibold text-slate-100 text-lg tracking-tight">
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
