import { z } from 'zod';
import { createSpaceDiscussionSummary } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createSummarizeSpaceDiscussionTool(
  authToken: string,
  requestUrlForSessionMatrix?: string,
) {
  const inputSchema = z.object({
    space_slug: z.string().trim().min(1),
  });

  return {
    description:
      'Generate and persist a summary of recent space chat discussion. Use when user asks to summarize current discussion or produce a memory snapshot.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) {
        return { ok: false, error: 'Invalid space slug format' };
      }
      const result = await createSpaceDiscussionSummary(
        {
          spaceSlug: safe,
          authToken,
          requestUrlForSessionMatrix,
        },
        { db },
      );
      if (!result.ok) return { ok: false, error: result.error };
      return {
        ok: true,
        summary_id: result.summaryId,
        message_count: result.messageCount,
        participant_count: result.participantCount,
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
