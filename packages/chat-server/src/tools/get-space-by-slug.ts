import { z } from 'zod';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import type { ChatRouteTool } from './types';
import { buildSpaceTransparencySnapshot } from './space-transparency-policy';

const getSpaceBySlugInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .describe('Hypha space slug, for example "hypha"'),
});

export const getSpaceBySlugTool = {
  description:
    'Returns one Hypha space record: title, description, activation flags, on-chain transparency (discoverability + activity access), privacy assessment, and aggregate counts. Use for overview, privacy questions, or "tell me about this space". Do not use for listing who the members are — use get_people_by_space_slug for roster questions.',
  inputSchema: getSpaceBySlugInputSchema,
  execute: async (args) => {
    const parsed = getSpaceBySlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        found: false,
        slug: '',
        space: null,
        error: parsed.error.message,
      };
    }
    const { slug } = parsed.data;
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

    const transparencySnapshot = await buildSpaceTransparencySnapshot({
      web3SpaceId: space.web3SpaceId ?? null,
      flags: space.flags ?? [],
    });

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
        flags: space.flags ?? [],
        activationMode: transparencySnapshot.activationMode,
        onChainTransparency: transparencySnapshot.onChainTransparency,
        privacy: transparencySnapshot.privacy,
        transparencyGovernance: transparencySnapshot.governance,
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
} satisfies ChatRouteTool<typeof getSpaceBySlugInputSchema>;
