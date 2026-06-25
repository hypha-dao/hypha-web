import { z } from 'zod';
import { createSpaceDiscussionSummary } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import { buildSpaceScreenNavigation } from './space-screen-navigation';

export function createSummarizeSpaceDiscussionTool(
  authToken: string,
  requestUrlForSessionMatrix?: string,
  defaultLocale?: string | null,
) {
  const inputSchema = z.object({
    space_slug: z.string().trim().min(1),
    lang: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  });

  return {
    description:
      'Generate and persist a summary of recent space chat discussion. Use when user asks to summarize current discussion or produce a memory snapshot. Returns navigation metadata so the app opens Space Memory.',
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
      let result: Awaited<ReturnType<typeof createSpaceDiscussionSummary>>;
      try {
        result = await createSpaceDiscussionSummary(
          {
            spaceSlug: safe,
            authToken,
            requestUrlForSessionMatrix,
          },
          { db },
        );
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to summarize discussion',
        };
      }
      if (!result.ok) return { ok: false, error: result.error };
      return {
        ok: true,
        summary_id: result.summaryId,
        message_count: result.messageCount,
        participant_count: result.participantCount,
        space_slug: safe,
        navigation: buildSpaceScreenNavigation({
          lang: parsed.data.lang ?? defaultLocale ?? undefined,
          spaceSlug: safe,
          screen: 'memory',
          label: 'Open Space Memory',
        }),
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
