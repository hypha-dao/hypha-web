import { z } from 'zod';
import { findAllSpaces } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';

const searchSpacesInputSchema = z.object({
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(20).optional().default(8),
});

export function createSearchSpacesTool() {
  return {
    description:
      'Read-only: search Hypha spaces by plain-language topic/keyword (title and description), useful when user asks to find spaces by theme or category.',
    inputSchema: searchSpacesInputSchema,
    execute: async (args) => {
      const parsed = searchSpacesInputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message, results: [] };
      }

      const { query, limit } = parsed.data;
      const spaces = await findAllSpaces(
        { db },
        {
          search: query,
          parentOnly: false,
          omitSandbox: true,
          omitArchived: true,
        },
      );

      const normalizedQuery = query.toLowerCase();
      const ranked = spaces
        .map((space) => {
          const title = (space.title ?? '').toLowerCase();
          const description = (space.description ?? '').toLowerCase();
          const categories = Array.isArray(space.categories)
            ? space.categories.map((c) => String(c).toLowerCase())
            : [];
          const titleScore = title.includes(normalizedQuery) ? 4 : 0;
          const descriptionScore = description.includes(normalizedQuery)
            ? 2
            : 0;
          const categoryScore = categories.some((c) =>
            c.includes(normalizedQuery),
          )
            ? 3
            : 0;
          return {
            space,
            score: titleScore + descriptionScore + categoryScore,
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score || a.space.title.localeCompare(b.space.title),
        )
        .slice(0, limit)
        .map(({ space }) => ({
          title: space.title,
          description: space.description ?? null,
          categories: Array.isArray(space.categories) ? space.categories : [],
          slug: space.slug,
        }));

      return {
        ok: true,
        query,
        count: ranked.length,
        results: ranked,
      };
    },
  } satisfies ChatRouteTool<typeof searchSpacesInputSchema>;
}
