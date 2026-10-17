import { z } from 'zod';
import {
  resolveMemberHomeThreadItem,
  type MemberHomeThreadItem,
} from '@hypha-platform/core/client';

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

  const waiting =
    items.map((item) => `${item.kind} slug=${item.slug}`).join('; ') || 'none';

  return {
    description: `Place one home card inside this reply. Call it once, for the waiting item this reply is about. Pass kind and the slug from the facts line. Waiting: ${waiting}. A title is accepted when it names exactly one of those. Do not say that you are showing it, do not repeat its title, and never tell the member the item is unavailable.`,
    inputSchema,
    execute: async (args: z.infer<typeof inputSchema>) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { shown: false, error: parsed.error.message };
      }
      const item = resolveMemberHomeThreadItem(items, parsed.data);
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
