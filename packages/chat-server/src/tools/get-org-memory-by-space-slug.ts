import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  getSpaceMembersRoster,
  serializeSpaceMembersRosterDatesForJson,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetOrgMemoryBySpaceSlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug of the active space'),
    page: z.number().int().min(1).optional().default(1),
    page_size: z.number().int().min(1).max(100).optional().default(20),
    searchTerm: z.string().optional(),
  });

  return {
    description:
      'Read-only: organisation memory projection for a Hypha space by slug. v1 returns the same member roster as get_people_by_space_slug (people + space-as-members, join metadata, full memberships fields when stored) plus org_memory_assets as an empty array until the org memory catalogue exists. Use for space memory, org memory, Coherence / Space Memory, or what the space knows (members today; indexed files when populated). Not a substitute for get_documents_by_space_slug for governance document lists, proposal workflow state, or voting status — use that tool for documents and attachment URLs on document rows.',
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

        const raw = await getSpaceMembersRoster(
          {
            spaceSlug: safe,
            page: toolArgs.page,
            pageSize: toolArgs.page_size,
            searchTerm: toolArgs.searchTerm,
          },
          { db },
        );
        const roster = serializeSpaceMembersRosterDatesForJson(raw);
        return { ...roster, org_memory_assets: [] as const };
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
