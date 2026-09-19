import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2,000 characters'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant'], {
          errorMap: () => ({ message: 'Role must be either user or assistant' }),
        }),
        content: z
          .string()
          .max(4000, 'History message cannot exceed 4,000 characters'),
      }),
    )
    .max(10, 'Conversation history is bounded to a maximum of 10 messages')
    .default([]),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

