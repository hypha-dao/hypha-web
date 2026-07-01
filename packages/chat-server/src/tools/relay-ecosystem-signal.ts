import { z } from 'zod';
import { relayAiSignalToEcosystemSpace } from '@hypha-platform/core/server';
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

export function createRelayEcosystemSignalTool(
  authToken: string,
  defaultLocale?: string | null,
) {
  const inputSchema = z.object({
    source_space_slug: z.string().trim().min(1),
    target_space_slug: z.string().trim().min(1),
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(20).max(4000),
    recommended_action: z.string().trim().min(10).max(1500),
    relevance_rationale: z.string().trim().min(20).max(2000),
    type: coherenceTypeSchema.default('Opportunity'),
    priority: coherencePrioritySchema.default('medium'),
    tags: z.array(z.string().trim().min(1)).optional().default([]),
    source_asset_keys: z.array(z.string().trim().min(1)).optional().default([]),
    lang: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  });

  return {
    description:
      'Write: relay a summarized/recomposed signal from one space to a relevant ecosystem space for action. Only allowed for interconnected, active paid spaces. Returns navigation metadata to open the relayed signal in the target space.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const sourceSafe = sanitizeSlug(parsed.data.source_space_slug);
      const targetSafe = sanitizeSlug(parsed.data.target_space_slug);
      if (!sourceSafe || !targetSafe) {
        return {
          ok: false,
          error: 'Invalid source or target space slug format',
        };
      }

      return relayAiSignalToEcosystemSpace(
        {
          sourceSpaceSlug: sourceSafe,
          targetSpaceSlug: targetSafe,
          authToken,
          title: parsed.data.title,
          summary: parsed.data.summary,
          recommendedAction: parsed.data.recommended_action,
          relevanceRationale: parsed.data.relevance_rationale,
          type: parsed.data.type,
          priority: parsed.data.priority,
          tags: parsed.data.tags,
          sourceAssetKeys: parsed.data.source_asset_keys,
          lang: parsed.data.lang ?? defaultLocale ?? undefined,
        },
        { db },
      );
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
