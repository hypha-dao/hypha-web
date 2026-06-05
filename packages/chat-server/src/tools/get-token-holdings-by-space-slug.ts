import { z } from 'zod';
import { getTokenHoldingsBySpaceSlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetTokenHoldingsBySpaceSlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .describe('Hypha space slug for treasury/token holdings'),
    include_zero_balances: z.boolean().optional().default(false),
    holder_limit: z.number().int().min(1).max(1000).optional(),
    include_treasury: z.boolean().optional().default(true),
  });

  return {
    description:
      'Read-only: token holdings and treasury distribution for a space by slug. Returns one row per token with holder slices and percentages.',
    inputSchema,
    execute: async (args) => {
      const parsedArgs = inputSchema.safeParse(args);
      if (!parsedArgs.success) {
        return {
          found: false,
          space_slug: '',
          error: parsedArgs.error.message,
        };
      }
      const toolArgs = parsedArgs.data;
      const safe = sanitizeSlug(toolArgs.space_slug);
      if (!safe) {
        return {
          found: false,
          space_slug: toolArgs.space_slug,
          error: 'Invalid space slug format',
        };
      }

      try {
        const gated = await getTokenHoldingsBySpaceSlug(
          {
            spaceSlug: safe,
            includeZeroBalances: toolArgs.include_zero_balances,
            holderLimit: toolArgs.holder_limit,
            includeTreasury: toolArgs.include_treasury,
          },
          { db, authToken },
        );

        if (gated.access === 'denied') {
          return {
            found: false,
            space_slug: safe,
            error: gated.message,
          };
        }

        return gated.result;
      } catch (err) {
        console.error(
          '[chat-tool:get_token_holdings_by_space_slug] execution failed',
          err,
        );
        return {
          found: false,
          space_slug: safe,
          error: 'Internal error while fetching token holdings',
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
