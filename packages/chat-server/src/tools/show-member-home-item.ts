import { z } from 'zod';
import type { MemberHomeThreadItem } from '@hypha-platform/core/client';

import type { ChatRouteTool } from './types';

/**
 * Places one waiting item inside the current reply.
 * The client draws the card from the member's own records, not from this text.
 */
export function createShowMemberHomeItemTool(
  items: readonly MemberHomeThreadItem[],
) {
  const inputSchema = z.object({
    kind: z.enum(['proposal', 'signal']),
    slug: z.string().trim().min(1),
  });

  return {
    description:
      'Place one home card inside this reply. Call it once, and only for the waiting item this reply is about. kind and slug must match that item. Do not say that you are showing it, and do not repeat its title.',
    inputSchema,
    execute: async (args: z.infer<typeof inputSchema>) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { shown: false, error: parsed.error.message };
      }
      const item = items.find(
        (candidate) =>
          candidate.kind === parsed.data.kind &&
          candidate.slug === parsed.data.slug,
      );
      if (!item) {
        return {
          shown: false,
          error: 'That item is not waiting on this member.',
        };
      }
      return {
        shown: true,
        kind: item.kind,
        slug: item.slug,
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
