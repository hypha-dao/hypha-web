import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  getAllOrganizationSpacesForNodeById,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetEcosystemBySpaceSlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug of the active space'),
    include_archived: z.boolean().optional().default(false),
  });

  return {
    description:
      'Read-only: returns the interconnected ecosystem for a space (root + descendants in the organisation tree) with parent/child links and summary counts.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          found: false,
          space_slug: '',
          error: parsed.error.message,
        };
      }

      const toolArgs = parsed.data;
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

        const organisationSpaces = await getAllOrganizationSpacesForNodeById({
          id: host.id,
        });
        const spaces = organisationSpaces.filter((space) =>
          toolArgs.include_archived ? true : !space.flags?.includes('archived'),
        );
        const byId = new Map(spaces.map((space) => [space.id, space]));
        const root = spaces.find((space) => space.parentId == null) ?? host;
        const childrenMap = new Map<number, number[]>();

        for (const space of spaces) {
          if (space.parentId == null || !byId.has(space.parentId)) continue;
          const children = childrenMap.get(space.parentId) ?? [];
          children.push(space.id);
          childrenMap.set(space.parentId, children);
        }

        const spaceRows = spaces.map((space) => ({
          id: space.id,
          slug: space.slug,
          title: space.title,
          description: space.description ?? null,
          parent_id: space.parentId ?? null,
          web3_space_id: space.web3SpaceId ?? null,
          member_count: space.memberCount ?? 0,
          document_count: space.documentCount ?? 0,
          is_archived: space.flags?.includes('archived') === true,
          flags: Array.isArray(space.flags) ? space.flags : [],
          created_at: new Date(space.createdAt).toISOString(),
          updated_at: new Date(space.updatedAt).toISOString(),
          child_space_ids: childrenMap.get(space.id) ?? [],
        }));

        return {
          found: true,
          space_slug: safe,
          root_space_slug: root.slug,
          root_space_id: root.id,
          ecosystem: {
            space_count: spaceRows.length,
            edge_count: spaceRows.reduce(
              (acc, space) => acc + space.child_space_ids.length,
              0,
            ),
          },
          spaces: spaceRows,
        };
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
