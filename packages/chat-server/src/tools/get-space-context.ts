import { z } from 'zod';
import {
  listSpaceContextSections,
  headingForSectionKey,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetSpaceContextTool(): ChatRouteTool {
  const inputSchema = z.object({
    space_slug: z.string().trim().min(1).describe('Hypha space slug'),
  });

  return {
    description:
      'Read-only: Space Context Markdown sections for a space (mission, vision, strategy, objectives, projects, key repositories, tools, how we decide). Status is not_started, draft, proposed, or ratified.',
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
          sections: overview.sections.map((section) => ({
            key: section.sectionKey,
            title: headingForSectionKey(section.sectionKey),
            status: section.status,
            markdown: section.markdown,
            version: section.version,
            updated_at: section.updatedAt,
          })),
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
