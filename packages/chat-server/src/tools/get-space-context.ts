import { z } from 'zod';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  listSpaceContextSections,
  toSpaceContextSectionOutput,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetSpaceContextTool(authToken: string): ChatRouteTool {
  const inputSchema = z.object({
    space_slug: z.string().trim().min(1).describe('Hypha space slug'),
  });

  return {
    description:
      'Read-only: Space Context Markdown sections for a space (mission, vision, strategy, objectives, key repositories, tools, how we decide, plus sections the space added). Status is not_started, draft, proposed, or ratified. `markdown` is the official text for ratified sections; `draft_markdown` is an unratified amendment; `pending_change` is a suggested add or remove that applies only when its proposal passes.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { found: false, error: parsed.error.message };
      }
      const spaceSlug = sanitizeSlug(parsed.data.space_slug);
      if (!spaceSlug) {
        return { found: false, error: 'Invalid space slug format' };
      }
      try {
        const host = await findSpaceBySlug({ slug: spaceSlug }, { db });
        if (!host) {
          return {
            found: false,
            space_slug: spaceSlug,
            error: 'Space not found',
          };
        }
        if (host.web3SpaceId != null) {
          if (!canConvertToBigInt(host.web3SpaceId)) {
            return {
              found: false,
              space_slug: spaceSlug,
              error: 'Invalid space identifier',
            };
          }
          const access = await checkSpaceAccessForSpace(host, authToken);
          if (!access.hasAccess) {
            return {
              found: false,
              space_slug: spaceSlug,
              error: access.message,
            };
          }
        }

        const overview = await listSpaceContextSections({ spaceSlug }, { db });
        if (!overview) {
          return {
            found: false,
            space_slug: spaceSlug,
            error: 'Space not found',
          };
        }
        return {
          found: true,
          space_slug: overview.spaceSlug,
          space_title: overview.spaceTitle,
          ratified_count: overview.ratifiedCount,
          total_count: overview.totalCount,
          sections: overview.sections.map(toSpaceContextSectionOutput),
        };
      } catch (error) {
        return {
          found: false,
          space_slug: spaceSlug,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  } as ChatRouteTool;
}
