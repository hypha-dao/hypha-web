import { z } from 'zod';
import { setupPhaseSchema, setupPlanSchema } from './onboarding-setup-state';

/** Minimal shape for UI message parts sent by @ai-sdk/react useChat. */
const chatUiMessagePartSchema = z.object({ type: z.string() }).passthrough();

/** Validates the chat request body before convertToModelMessages runs. */
export const chatUiMessageSchema = z.object({
  id: z.string().min(1),
  // Be permissive with roles used by evolving AI SDK message histories.
  role: z.enum(['system', 'user', 'assistant', 'tool', 'data']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parts: z.array(chatUiMessagePartSchema).optional().default([]),
  // Backward compatibility for payloads that still send string `content`.
  content: z.string().optional(),
});

const onboardingConversationContextSchema = z.object({
  mode: z.literal('onboarding_setup'),
  source: z.literal('onboarding_hero').optional(),
  setupPhase: setupPhaseSchema.optional(),
  setupPlan: setupPlanSchema.optional(),
  lastUserText: z.string().optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  createdAt: z.string().optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatUiMessageSchema),
  spaceSlug: z.string().nullish(),
  conversationContext: onboardingConversationContextSchema.optional(),
});

export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;
