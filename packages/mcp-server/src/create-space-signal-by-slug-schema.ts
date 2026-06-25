import { z } from 'zod';

const aiSignalNavigationSchema = z.object({
  kind: z.literal('internal'),
  href: z.string(),
  open_human_chat: z.literal(true),
  chat_target: z.literal('signal_chat'),
  signal_slug: z.string(),
  signal_title: z.string(),
  room_id: z.string().optional(),
  label: z.string(),
});

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
  lang: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
    .optional(),
});

export const createSpaceSignalBySlugOutputSchema = z.union([
  z.object({
    ok: z.literal(true),
    signalId: z.number(),
    signalSlug: z.string(),
    spaceSlug: z.string(),
    creatorId: z.number(),
    navigation: aiSignalNavigationSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);
