import { z } from 'zod';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import type { ChatRouteTool } from './types.js';

export const getSpaceBySlugTool = {
  description:
    'Returns one Hypha space record: title, description, and aggregate counts (member count, document count, subspace count). Use for overview or "tell me about this space". Do not use for listing who the members are, names, roster, or join dates — use get_people_by_space_slug for any question about the member list or individuals.',
  inputSchema: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug, for example "hypha"'),
  }),
  execute: async (args: unknown) => {
    const { slug } = args as { slug: string };
    let space;
    try {
      space = await getSpaceBySlug({ slug });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { found: false, slug, space: null, error: message };
    }
    if (!space) {
      return { found: false, slug, space: null };
    }

    const result = {
      found: true,
      slug,
      space: {
        id: String(space.id),
        slug: space.slug,
        title: space.title,
        description: space.description ?? null,
        parentId: space.parentId ? String(space.parentId) : null,
        web3SpaceId: space.web3SpaceId ?? null,
        memberCount:
          typeof space.memberCount === 'number'
            ? space.memberCount
            : Array.isArray(space.members)
            ? space.members.length
            : 0,
        documentCount:
          typeof space.documentCount === 'number'
            ? space.documentCount
            : Array.isArray(space.documents)
            ? space.documents.length
            : 0,
        subspaceCount: Array.isArray(space.subspaces)
          ? space.subspaces.length
          : 0,
        createdAt: new Date(space.createdAt).toISOString(),
        updatedAt: new Date(space.updatedAt).toISOString(),
      },
    };
    return result;
  },
} satisfies ChatRouteTool;
