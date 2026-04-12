import { z } from 'zod';

/** Minimal shape for UI message parts sent by @ai-sdk/react useChat. */
const chatUiMessagePartSchema = z.object({ type: z.string() }).passthrough();

/** Validates the chat request body before convertToModelMessages runs. */
export const chatUiMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['system', 'user', 'assistant']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parts: z.array(chatUiMessagePartSchema),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatUiMessageSchema),
  spaceSlug: z.string().nullish(),
});

export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;
