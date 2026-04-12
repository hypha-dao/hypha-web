import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  getDocumentsBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetDocumentsBySpaceSlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug of the active space'),
    page: z.number().int().min(1).optional().default(1),
    page_size: z.number().int().min(1).max(100).optional().default(20),
    searchTerm: z.string().optional(),
    state: z
      .enum(['discussion', 'proposal', 'agreement'])
      .optional()
      .describe('Optional filter by document state'),
  });

  return {
    description:
      'Read-only: lists documents in a Hypha space by slug (proposals, discussions, agreements from the documents table). Includes creator summary, state, slug, label, web3 proposal id, attachments, timestamps. Optional full-text search on title/description (same as app). Use for "what proposals", "list documents", "agreements in this space". Not for member roster — use get_people_by_space_slug.',
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
        const host = await findSpaceBySlug({ slug: safe }, { db });
        if (!host) {
          return {
            found: false,
            space_slug: safe,
            error: 'Space not found',
          };
        }
        if (host.web3SpaceId != null) {
          if (!canConvertToBigInt(host.web3SpaceId)) {
            return {
              found: false,
              space_slug: safe,
              error: 'Invalid space identifier',
            };
          }
          const access = await checkSpaceAccessForSpace(host, authToken);
          if (!access.hasAccess) {
            return {
              found: false,
              space_slug: safe,
              error: access.message,
            };
          }
        }

        const gated = await getDocumentsBySpaceSlug(
          {
            spaceSlug: safe,
            page: toolArgs.page,
            pageSize: toolArgs.page_size,
            searchTerm: toolArgs.searchTerm,
            state: toolArgs.state,
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
        const message = err instanceof Error ? err.message : 'Unknown error';
        return {
          found: false,
          space_slug: safe,
          error: message,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
