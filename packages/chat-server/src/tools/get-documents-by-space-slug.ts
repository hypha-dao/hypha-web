import { z } from 'zod';
import { getDocumentsBySpaceSlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
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
      'Read-only: lists documents in a Hypha space by slug (proposals, discussions, agreements from the documents table). For documents with web3ProposalId and on-chain data, includes proposal outcome status: accepted, rejected, or onVoting (same logic as the space documents UI). Also returns state (discussion/proposal/agreement DB enum), creator summary, slug, label, attachments, timestamps. Optional full-text search. Not for member roster — use get_people_by_space_slug.',
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
        console.error(
          '[chat-tool:get_documents_by_space_slug] execution failed',
          err,
        );
        return {
          found: false,
          space_slug: safe,
          error: 'Internal error while fetching documents',
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
