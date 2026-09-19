import { GoogleGenAI, type Content } from '@google/genai';
import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.6-flash';
export const GEMINI_TIMEOUT_MS = 30_000;
export const GEMINI_TEMPERATURE = 0.3;
export const GEMINI_MAX_OUTPUT_TOKENS = 2048;

let genAiInstance: GoogleGenAI | null = null;

export const isGeminiConfigured = (): boolean => {
  return Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);
};

const getGenAiClient = (): GoogleGenAI => {
  if (!isGeminiConfigured()) {
    throw new AppError(
      503,
      ERROR_CODES.AI_DISABLED,
      'Gemini AI Assistant is not configured. Please set GEMINI_API_KEY.',
    );
  }

  if (!genAiInstance) {
    genAiInstance = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY!.trim() });
  }

  return genAiInstance;
};

export type GeminiChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type GenerateContentInput = {
  systemInstruction: string;
  history: GeminiChatHistoryItem[];
  message: string;
  signal?: AbortSignal;
};

export type GeminiGeneratedOutput = {
  text: string;
  tokensUsed?: number;
};

/**
 * Executes a generation request against Gemini 2.5 Flash with strict bounds,
 * timeout enforcement, AbortSignal support, and error sanitization.
 */
export const callGemini = async (
  input: GenerateContentInput,
): Promise<GeminiGeneratedOutput> => {
  const ai = getGenAiClient();

  // Combine client cancellation signal with a hard 30s timeout signal
  const timeoutSignal = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  const combinedSignal = input.signal
    ? AbortSignal.any([input.signal, timeoutSignal])
    : timeoutSignal;

  const contents: Content[] = [
    ...input.history.map((item) => ({
      role: (item.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: item.content }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: input.message }],
    },
  ];

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: input.systemInstruction,
          temperature: GEMINI_TEMPERATURE,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          abortSignal: combinedSignal,
        },
      });
    } catch (primaryErr: unknown) {
      const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('no longer available')) {
        logger.info('gemini.fallback_model', { from: GEMINI_MODEL, to: GEMINI_FALLBACK_MODEL });
        response = await ai.models.generateContent({
          model: GEMINI_FALLBACK_MODEL,
          contents,
          config: {
            systemInstruction: input.systemInstruction,
            temperature: GEMINI_TEMPERATURE,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            abortSignal: combinedSignal,
          },
        });
      } else {
        throw primaryErr;
      }
    }

    const responseText = response.text?.trim();

    if (!responseText) {
      throw new AppError(
        502,
        ERROR_CODES.AI_GENERATION_FAILED,
        'No readable answer returned by Gemini.',
      );
    }

    const tokensUsed =
      response.usageMetadata?.totalTokenCount ??
      response.usageMetadata?.candidatesTokenCount;

    return {
      text: responseText,
      tokensUsed,
    };
  } catch (error: unknown) {
    // If the error was an intentional client abort
    if (input.signal?.aborted) {
      const abortErr = new Error('Request was cancelled.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    // If the operation timed out after 30s
    if (timeoutSignal.aborted) {
      logger.warn('gemini.timeout', { model: GEMINI_MODEL, timeoutMs: GEMINI_TIMEOUT_MS });
      throw new AppError(
        504,
        ERROR_CODES.AI_GENERATION_FAILED,
        'Gemini took too long to respond. Please try again shortly.',
      );
    }

    if (error instanceof AppError) {
      throw error;
    }

    const rawMessage = error instanceof Error ? error.message : String(error);
    const lower = rawMessage.toLowerCase();

    logger.error('gemini.error', {
      error: rawMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (
      lower.includes('quota') ||
      lower.includes('rate limit') ||
      lower.includes('resource_exhausted') ||
      lower.includes('429')
    ) {
      throw new AppError(
        429,
        ERROR_CODES.RATE_LIMITED,
        'AI rate limit reached. Please wait a moment and try again.',
      );
    }

    if (lower.includes('safety') || lower.includes('blocked') || lower.includes('filter')) {
      throw new AppError(
        400,
        ERROR_CODES.AI_GENERATION_FAILED,
        'The query could not be processed due to safety filters.',
      );
    }

    if (
      lower.includes('econnrefused') ||
      lower.includes('etimedout') ||
      lower.includes('enotfound') ||
      lower.includes('fetch failed')
    ) {
      throw new AppError(
        503,
        ERROR_CODES.AI_GENERATION_FAILED,
        'Unable to reach Gemini API. Please check your network connection.',
      );
    }

    throw new AppError(
      502,
      ERROR_CODES.AI_GENERATION_FAILED,
      'Unable to process your question right now. Please try again.',
    );
  }
};
