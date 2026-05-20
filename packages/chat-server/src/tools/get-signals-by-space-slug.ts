import { z } from 'zod';
import {
  COHERENCE_TAGS,
  COHERENCE_TYPES,
  checkSpaceAccessForSpace,
  findAllCoherences,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export function createGetSignalsBySpaceSlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug of the active space'),
    include_archived: z.boolean().optional().default(false),
    type: z.enum(COHERENCE_TYPES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    order_by: z
      .enum(['mostrecent', 'mostmessages', 'mostviews'])
      .optional()
      .default('mostrecent'),
    limit: z.number().int().min(1).max(200).optional().default(100),
  });

  return {
    description:
      'Read-only: returns the space signal board context (coherences) plus taxonomy used to propose new high-quality signals. Includes current signals with type/priority/tags, summary counts, and top tags for strategic gap analysis.',
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

        const coercedTags = (toolArgs.tags ?? [])
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);

        const rows = await findAllCoherences(
          { db },
          {
            spaceId: host.id,
            includeArchived: toolArgs.include_archived,
            type: toolArgs.type,
            priority: toolArgs.priority,
            tags: coercedTags,
            orderBy: toolArgs.order_by,
          },
        );

        const selectedRows = rows.slice(0, toolArgs.limit);
        const byType = Object.fromEntries(
          COHERENCE_TYPES.map((type) => [
            type,
            selectedRows.filter((row) => row.type === type).length,
          ]),
        );
        const byPriority = Object.fromEntries(
          PRIORITIES.map((priority) => [
            priority,
            selectedRows.filter((row) => row.priority === priority).length,
          ]),
        );

        const tagCounts = new Map<string, number>();
        for (const row of selectedRows) {
          for (const tag of row.tags ?? []) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          }
        }
        const topTags = [...tagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([tag, count]) => ({ tag, count }));

        return {
          found: true,
          space_slug: safe,
          space: {
            title: host.title ?? safe,
            description: host.description ?? null,
          },
          signal_taxonomy: {
            allowed_types: COHERENCE_TYPES,
            allowed_priorities: PRIORITIES,
            suggested_tags: COHERENCE_TAGS,
          },
          summary: {
            total_signals: selectedRows.length,
            filtered_from_total: rows.length,
            by_type: byType,
            by_priority: byPriority,
            top_tags: topTags,
          },
          signals: selectedRows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            type: row.type,
            priority: row.priority,
            tags: row.tags ?? [],
            messages: row.messages ?? 0,
            views: row.views ?? 0,
            archived: row.archived,
            created_at: row.createdAt.toISOString(),
            updated_at: row.updatedAt.toISOString(),
          })),
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
