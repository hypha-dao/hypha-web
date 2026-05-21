import { z } from 'zod';
import { createAiSignalForSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

const coherenceTypeSchema = z.enum([
  'Opportunity',
  'Risk',
  'Tension',
  'Insight',
  'Trend',
  'Proposal',
]);
const coherencePrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export function createCreateSpaceSignalBySlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z.string().trim().min(1),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(20).max(5000),
    type: coherenceTypeSchema.default('Insight'),
    priority: coherencePrioritySchema.default('medium'),
    tags: z.array(z.string().trim().min(1)).optional().default([]),
  });

  return {
    description:
      'Write: create a new signal in a space when the recommendation is relevant and evidence-backed. Allowed for active paid spaces only.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return { ok: false, error: 'Invalid space slug format' };

      return createAiSignalForSpaceBySlug(
        {
          spaceSlug: safe,
          authToken,
          title: parsed.data.title,
          description: parsed.data.description,
          type: parsed.data.type,
          priority: parsed.data.priority,
          tags: parsed.data.tags,
        },
        { db },
      );
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
