import { z } from 'zod';

export const relayEcosystemSignalInputSchema = z
  .object({
    source_space_slug: z.string().trim().min(1),
    target_space_slug: z.string().trim().min(1),
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(20).max(4000),
    recommended_action: z.string().trim().min(10).max(1500),
    relevance_rationale: z.string().trim().min(20).max(2000),
    type: z
      .enum(['Opportunity', 'Risk', 'Tension', 'Insight', 'Trend', 'Proposal'])
      .optional()
      .default('Opportunity'),
    priority: z
      .enum(['critical', 'high', 'medium', 'low'])
      .optional()
      .default('medium'),
    tags: z.array(z.string().trim().min(1)).optional().default([]),
    source_asset_keys: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .refine((input) => input.source_space_slug !== input.target_space_slug, {
    message: 'source and target slugs must be different',
    path: ['target_space_slug'],
  });

export const relayEcosystemSignalOutputSchema = z.union([
  z.object({
    ok: z.literal(true),
    signalId: z.number(),
    signalSlug: z.string(),
    sourceSpaceSlug: z.string(),
    targetSpaceSlug: z.string(),
    creatorId: z.number(),
    navigation: z.object({
      kind: z.literal('internal'),
      href: z.string(),
      open_human_chat: z.literal(true),
      chat_target: z.literal('signal_chat'),
      signal_slug: z.string(),
      signal_title: z.string(),
      room_id: z.string().optional(),
      label: z.string(),
    }),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);
