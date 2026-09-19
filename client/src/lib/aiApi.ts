import { apiRequest } from './api';

export type AiSourceType = 'expense' | 'settlement' | 'group' | 'member';

export type AiSource = {
  type: AiSourceType;
  id: string;
  label: string;
  groupId?: string;
  groupName?: string;
};

export type AiChatResponse = {
  answer: string;
  sources: AiSource[];
  intent: string;
  language: 'en' | 'hi' | 'hinglish';
  metadata: {
    tokensUsed?: number;
    latencyMs: number;
    dataPointsUsed: number;
  };
};

export type ChatHistoryPayload = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Sends a conversational message to the SplitWise AI Assistant.
 * Passes previous in-memory conversation history and optional AbortSignal for cancellation.
 */
export const sendAiMessage = async (
  message: string,
  history: ChatHistoryPayload[] = [],
  signal?: AbortSignal,
): Promise<AiChatResponse> => {
  return apiRequest<AiChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
    signal,
  });
};

