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

export function createGetPeopleBySpaceSlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'space_slug must use lowercase letters, numbers, and hyphens',
      )
      .describe('Hypha space slug of the active space'),
    page: z.number().int().min(1).optional().default(1),
    page_size: z.number().int().min(1).max(100).optional().default(20),
    searchTerm: z.string().optional(),
  });

  return {
    description:
      'Read-only: lists members of a Hypha space by slug — people and other spaces that appear as on-chain members (Members tab parity). Join times use memberships when present, else joinSpace events (joined_at and join_source in the result). Includes full memberships fields for people when stored in the database. Use for roster, who belongs, which other spaces are in the member list, and when someone joined. Not for listing child subspaces by parent_id.',
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
        return serializeSpaceMembersRosterDatesForJson(raw);
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
