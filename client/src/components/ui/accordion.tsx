import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  children,
  isOpen = false,
  onToggle,
  className,
}) => {
  return (
    <div
      className={cn(
        'border border-slate-200/80 rounded-2xl bg-white overflow-hidden transition-all duration-200',
        isOpen ? 'shadow-md shadow-slate-900/5 border-emerald-300' : 'hover:border-slate-300',
        className,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left font-semibold text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-expanded={isOpen}
      >
        <span className="text-base sm:text-lg pr-4">{title}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-slate-400 flex-shrink-0 transition-transform duration-200',
            isOpen && 'transform rotate-180 text-primary',
          )}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
};

