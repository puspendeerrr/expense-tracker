import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { sendAiMessage, type AiSource, type ChatHistoryPayload } from '@/lib/aiApi';
import { ApiClientError } from '@/lib/api';

export type AiMessageStatus = 'complete' | 'loading' | 'error' | 'cancelled';

export type AiChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSource[];
  intent?: string;
  language?: string;
  status: AiMessageStatus;
  errorMessage?: string;
  timestamp: Date;
};

export type AiChatStatus = 'idle' | 'sending' | 'generating' | 'success' | 'error' | 'cancelled';

export interface AiChatContextType {
  messages: AiChatMessage[];
  isOpen: boolean;
  status: AiChatStatus;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  stopGenerating: () => void;
  retryLastMessage: () => Promise<void>;
  clearChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
}

const AiChatContext = createContext<AiChatContextType | undefined>(undefined);

export const AiChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pure React in-memory state. Dies on browser refresh or tab close.
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AiChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setStatus('idle');
    setError(null);
  }, []);

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('cancelled');
    setMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (lastIndex >= 0 && prev[lastIndex]?.status === 'loading') {
        const updated = [...prev];
        updated[lastIndex] = {
          ...updated[lastIndex]!,
          status: 'cancelled',
          content: updated[lastIndex]!.content || 'Response generation stopped.',
        };
        return updated;
      }
      return prev;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'sending' || status === 'generating') return;

      // Abort any lingering operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMsgId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const assistantMsgId = `assistant-${Date.now() + 1}-${Math.random().toString(36).slice(2, 7)}`;

      const userMessage: AiChatMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        status: 'complete',
        timestamp: new Date(),
      };

      const pendingAssistantMessage: AiChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        status: 'loading',
        timestamp: new Date(),
      };

      // Extract up to 10 previous messages for conversation continuity
      const historyPayload: ChatHistoryPayload[] = messages
        .filter((m) => m.status === 'complete' && m.content.trim().length > 0)
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      setMessages((prev) => [...prev, userMessage, pendingAssistantMessage]);
      setStatus('sending');
      setError(null);

      try {
        // Transition to generating
        setStatus('generating');

        const response = await sendAiMessage(trimmed, historyPayload, controller.signal);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: response.answer,
                  sources: response.sources,
                  intent: response.intent,
                  language: response.language,
                  status: 'complete',
                }
              : msg,
          ),
        );

        setStatus('success');
      } catch (err: unknown) {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          setStatus('cancelled');
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: msg.content || 'Response generation stopped.',
                    status: 'cancelled',
                  }
                : msg,
            ),
          );
          return;
        }

        let errorMsg = 'Failed to get a response. Please try again.';
        if (err instanceof ApiClientError) {
          if (err.code === 'RATE_LIMITED') {
            errorMsg = 'AI request limit reached. You can send up to 20 messages per 15 minutes.';
          } else if (err.code === 'UNAUTHENTICATED') {
            errorMsg = 'Your session has expired. Please sign in again to continue.';
          } else if (err.message) {
            errorMsg = err.message;
          }
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }

        setError(errorMsg);
        setStatus('error');

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: '',
                  status: 'error',
                  errorMessage: errorMsg,
                }
              : msg,
          ),
        );
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [messages, status],
  );

  const retryLastMessage = useCallback(async () => {
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove the failed assistant message
    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length > 0 && copy[copy.length - 1]?.role === 'assistant') {
        copy.pop();
      }
      return copy;
    });

    await sendMessage(lastUserMsg.content);
  }, [messages, sendMessage]);

  const value: AiChatContextType = {
    messages,
    isOpen,
    status,
    error,
    sendMessage,
    stopGenerating,
    retryLastMessage,
    clearChat,
    openChat,
    closeChat,
    toggleChat,
  };

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
};

export const useAiChat = (): AiChatContextType => {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error('useAiChat must be used within an AiChatProvider');
  }
  return context;
};
