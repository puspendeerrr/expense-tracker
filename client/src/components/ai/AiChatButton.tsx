import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAiChat } from '@/hooks/useAiChat';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const AiChatButton: React.FC = () => {
  const { toggleChat, isOpen } = useAiChat();

  // Hide button when drawer is already open to avoid overlapping
  if (isOpen) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleChat}
            className={cn(
              'fixed z-40 flex items-center justify-center rounded-full',
              // Desktop: 56px (h-14 w-14) at bottom-6 right-6
              // Mobile: 48px+ (h-12 w-12) at bottom-6 right-4
              'bottom-6 right-4 sm:bottom-6 sm:right-6',
              'h-12 w-12 sm:h-14 sm:w-14',
              'bg-primary text-primary-foreground',
              'shadow-lg shadow-emerald-700/25 dark:shadow-emerald-950/50',
              'border border-primary-foreground/10',
              'transition-[transform,box-shadow] duration-200 ease-out',
              'hover:scale-105 active:scale-95 hover:shadow-xl hover:shadow-emerald-700/35',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            aria-label="Ask AI Assistant"
          >
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:rotate-12" />
            <span className="sr-only">Ask AI Assistant</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={12} className="text-xs font-semibold">
          Ask SplitMoney AI
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

