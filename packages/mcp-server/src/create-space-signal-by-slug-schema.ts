import { z } from 'zod';

export const createSpaceSignalBySlugInputSchema = z.object({
  space_slug: z.string().trim().min(1),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(5000),
  type: z
    .enum(['Opportunity', 'Risk', 'Tension', 'Insight', 'Trend', 'Proposal'])
    .optional()
    .default('Insight'),
  priority: z
    .enum(['critical', 'high', 'medium', 'low'])
    .optional()
    .default('medium'),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
});

export const createSpaceSignalBySlugOutputSchema = z.object({
  ok: z.boolean(),
  signalId: z.number().optional(),
  signalSlug: z.string().nullable().optional(),
  spaceSlug: z.string().optional(),
  creatorId: z.number().optional(),
  error: z.string().optional(),
});
