import type { Request, Response } from 'express';
import { sendOk } from '../utils/http.js';
import { validated } from '../middleware/validate.js';
import { chatMessageSchema, type ChatMessageInput } from '../validation/aiSchemas.js';
import { chatWithAi } from '../services/aiService.js';

export const chat = async (req: Request, res: Response): Promise<void> => {
  const input = validated(req, chatMessageSchema) as ChatMessageInput;

  // Support client-side request cancellation via AbortController
  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const result = await chatWithAi({
    user: req.user!,
    message: input.message,
    history: input.history,
    signal: abortController.signal,
  });

  sendOk(res, result);
};

