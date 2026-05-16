import { z } from 'zod';

export const relayEcosystemSignalInputSchema = z.object({
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
});

export const relayEcosystemSignalOutputSchema = z.object({
  ok: z.boolean(),
  signalId: z.number().optional(),
  signalSlug: z.string().nullable().optional(),
  sourceSpaceSlug: z.string().optional(),
  targetSpaceSlug: z.string().optional(),
  creatorId: z.number().optional(),
  error: z.string().optional(),
});
