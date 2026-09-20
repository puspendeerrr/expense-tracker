import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Square,
  Info,
  CornerDownLeft,
  ArrowLeft,
} from 'lucide-react';
import { useAiChat } from '@/hooks/useAiChat';
import { AiMessageBubble } from './AiMessageBubble';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const SUGGESTED_PROMPTS = [
  'What do I owe everyone?',
  'Who owes me?',
  'Rahul ko mujhe kitna dena hai?',
  'How much did we spend on groceries?',
  'Show pending settlements',
  'What happened in my groups recently?',
];

export const AiChatPanel: React.FC = () => {
  const { user } = useAuth();
  const {
    messages,
    isOpen,
    status,
    sendMessage,
    stopGenerating,
    retryLastMessage,
    clearChat,
    closeChat,
  } = useAiChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = status === 'sending' || status === 'generating';

  // Prevent background and dashboard scrolling when chat panel is open
  useEffect(() => {
    if (!isOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  // Auto-scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Focus input on drawer open
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Handle ESC key to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeChat]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    setInput('');
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={closeChat}
      />

      {/* Slide-in Drawer Container: full-width edge-to-edge on mobile, 440px on desktop */}
      <div
        className={cn(
          'relative z-10 flex h-[100dvh] w-full flex-col bg-card shadow-2xl overflow-hidden',
          'sm:max-w-[440px] sm:border-l sm:border-border',
          'animate-slide-in-right motion-reduce:animate-none',
        )}
      >
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="h-8 w-8 text-muted-foreground hover:text-foreground sm:hidden"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-foreground">SplitMoney AI</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Gemini 2.5
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Financial assistant • Read-only</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Close panel (Esc)"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Message View Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overscroll-contain">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col justify-between py-6">
              <div className="space-y-4 text-center sm:text-left">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Hello, {user?.fullName?.split(' ')[0] || 'there'}!
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    I can help you understand who owes whom, break down recent group spending, or check
                    pending settlements across your groups.
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/50 p-3 text-left text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    <span>Authoritative & Grounded</span>
                  </div>
                  <p className="leading-relaxed">
                    All balances are calculated directly by SplitMoney's PostgreSQL ledger. Ask questions in
                    English or Hinglish!
                  </p>
                </div>
              </div>

              {/* Suggested Questions */}
              <div className="space-y-2 pt-6">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Suggested Questions
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border border-border/80 bg-card p-2.5 text-left text-xs font-medium text-foreground',
                        'transition-colors hover:border-primary/40 hover:bg-accent/70 active:scale-[0.99]',
                      )}
                    >
                      <span className="truncate">{prompt}</span>
                      <CornerDownLeft className="h-3 w-3 shrink-0 text-muted-foreground opacity-70" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <AiMessageBubble
                  key={msg.id}
                  message={msg}
                  onRetry={msg.status === 'error' ? retryLastMessage : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Floating Stop Generating Control */}
        {isGenerating && (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={stopGenerating}
              className="h-8 gap-1.5 rounded-full border-border bg-card px-3 text-xs shadow-md hover:bg-accent"
            >
              <Square className="h-3 w-3 fill-destructive text-destructive" />
              <span>Stop Generating</span>
            </Button>
          </div>
        )}

        {/* Input Footer */}
        <footer className="shrink-0 border-t border-border bg-card p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <form onSubmit={handleSend} className="relative flex items-end gap-2">
            <div className="relative flex-1 rounded-2xl border border-input bg-muted/40 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-ring">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about debts, expenses, or settlements..."
                rows={1}
                maxLength={2000}
                className={cn(
                  'max-h-32 min-h-[44px] w-full resize-none bg-transparent px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none',
                )}
                disabled={isGenerating}
              />
            </div>

            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isGenerating}
              className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
            <span>Enter to send • Shift + Enter for new line</span>
            {input.length > 1500 && (
              <span className={input.length > 1900 ? 'text-destructive font-bold' : ''}>
                {input.length}/2000
              </span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
