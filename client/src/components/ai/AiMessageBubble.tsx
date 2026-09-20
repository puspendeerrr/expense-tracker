import React, { useState } from 'react';
import { Copy, Check, Sparkles, AlertCircle, RefreshCw, StopCircle } from 'lucide-react';
import type { AiChatMessage } from '@/hooks/useAiChat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AiMessageBubbleProps {
  message: AiChatMessage;
  onRetry?: () => void;
}

/**
 * Clean markdown-like renderer supporting bold, lists, rupee amounts, and code tags.
 */
const renderFormattedContent = (content: string) => {
  const lines = content.split('\n');

  return lines.map((line, lineIdx) => {
    // Empty line creates vertical breathing room
    if (!line.trim()) {
      return <div key={lineIdx} className="h-2" />;
    }

    // Bullet points (* or -)
    const isBullet = /^[\s]*[-*•]\s+(.*)$/.exec(line);
    if (isBullet) {
      return (
        <div key={lineIdx} className="my-0.5 flex items-start gap-2 pl-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
          <span className="flex-1 leading-relaxed">
            {renderInlineSpans(isBullet[1]!)}
          </span>
        </div>
      );
    }

    // Numbered lists (e.g. 1. or 2.)
    const isNumbered = /^[\s]*(\d+)\.\s+(.*)$/.exec(line);
    if (isNumbered) {
      return (
        <div key={lineIdx} className="my-0.5 flex items-start gap-2 pl-2">
          <span className="shrink-0 font-mono text-xs font-bold text-primary">
            {isNumbered[1]}.
          </span>
          <span className="flex-1 leading-relaxed">
            {renderInlineSpans(isNumbered[2]!)}
          </span>
        </div>
      );
    }

    // Standard paragraph line
    return (
      <p key={lineIdx} className="leading-relaxed">
        {renderInlineSpans(line)}
      </p>
    );
  });
};

/**
 * Handles inline bold (**text**), code (`code`), and highlighted currency (₹...).
 */
const renderInlineSpans = (text: string): React.ReactNode => {
  // Split on bold or code blocks
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {inner}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground"
        >
          {inner}
        </code>
      );
    }

    return part;
  });
};

export const AiMessageBubble: React.FC<AiMessageBubbleProps> = ({
  message,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(message.timestamp);

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1 pl-10">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-xs">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">{formattedTime}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 pr-4 sm:pr-8">
      <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-2.5 w-2.5" />
        </div>
        <span className="font-semibold text-foreground">SplitMoney AI</span>
        <span className="text-[10px]">• {formattedTime}</span>
      </div>

      <div
        className={cn(
          'w-full max-w-[95%] rounded-2xl rounded-tl-sm border border-border bg-card p-3.5 text-sm text-foreground shadow-xs',
          message.status === 'error' && 'border-destructive/40 bg-destructive/5',
        )}
      >
        {/* Loading state with animated dots */}
        {message.status === 'loading' && (
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
            <span className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
            </span>
            <span className="text-xs font-medium">Verifying ledger and preparing answer...</span>
          </div>
        )}

        {/* Cancelled state */}
        {message.status === 'cancelled' && (
          <div className="space-y-2">
            {message.content && message.content !== 'Response generation stopped.' ? (
              <div className="space-y-1 text-sm">{renderFormattedContent(message.content)}</div>
            ) : null}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StopCircle className="h-3.5 w-3.5 text-amber-500" />
              <span className="italic">Generation was stopped.</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {message.status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-medium leading-normal">
                {message.errorMessage || 'Unable to complete your request at this moment.'}
              </p>
            </div>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs gap-1.5 border-destructive/30 hover:bg-destructive/10"
              >
                <RefreshCw className="h-3 w-3" />
                Retry Question
              </Button>
            )}
          </div>
        )}

        {/* Complete state */}
        {message.status === 'complete' && (
          <div className="space-y-3">
            <div className="space-y-1 text-sm leading-relaxed">
              {renderFormattedContent(message.content)}
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-end gap-1 pt-1">
              <button
                type="button"
                onClick={copyContent}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Copy message"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-primary" />
                    <span className="text-primary">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

