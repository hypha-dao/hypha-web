import { z } from 'zod';
import { getNetworkEcosystemPatterns } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(40),
  min_child_count: z.number().int().min(2).max(50).optional().default(2),
});

export function createGetNetworkEcosystemPatternsTool() {
  return {
    description:
      'Read-only organisational guidance: analyze ecosystems across the Hypha network. Returns common child-space roles, title keywords, and sample ecosystem structures to inform multi-space setup.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      try {
        const patterns = await getNetworkEcosystemPatterns(
          {
            limit: parsed.data.limit,
            minChildCount: parsed.data.min_child_count,
          },
          { db },
        );
        return { ok: true, ...patterns };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return {
          ok: true,
          degraded: true,
          warning: message,
          sampled_ecosystem_count: 0,
          total_ecosystems_with_children: 0,
          average_child_count: 0,
          common_role_counts: {},
          frequent_child_title_keywords: [],
          samples: [],
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
