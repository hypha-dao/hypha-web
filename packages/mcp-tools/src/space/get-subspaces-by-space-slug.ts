import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

export const getSubspacesBySpaceSlugInputSchema = {
  slug: z
    .string()
    .trim()
    .min(1, 'Space slug is required')
    .describe('Hypha space slug, for example "hypha"'),
};

const subspaceSchema = z
  .object({
    id: z.number(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    parentId: z.number().nullable(),
    web3SpaceId: z.number().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const getSubspacesBySpaceSlugOutputSchema = z
  .object({
    spaceFound: z.boolean(),
    slug: z.string(),
    parentSpace: z
      .object({
        id: z.number(),
        slug: z.string(),
        title: z.string(),
      })
      .nullable(),
    subspaces: z.array(subspaceSchema),
  })
  .strict();

type GetSubspacesBySpaceSlugStructuredContent = z.infer<
  typeof getSubspacesBySpaceSlugOutputSchema
>;

function safeDateToISOString(value: unknown): string {
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return new Date(0).toISOString();
  }
  return candidate.toISOString();
}

export async function handleGetSubspacesBySpaceSlug({
  slug,
}: {
  slug: string;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetSubspacesBySpaceSlugStructuredContent;
}> {
  const space = await findSpaceBySlug({ slug }, { db });

  if (!space) {
    const output: GetSubspacesBySpaceSlugStructuredContent = {
      spaceFound: false,
      slug,
      parentSpace: null,
      subspaces: [],
    };

    return {
      content: [
        {
          type: 'text',
          text: `No space found for slug "${slug}".`,
        },
      ],
      structuredContent: output,
    };
  }

  const subspaces = (space.subspaces ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    description: s.description,
    parentId: s.parentId ?? null,
    web3SpaceId: s.web3SpaceId ?? null,
    createdAt: safeDateToISOString(s.createdAt),
    updatedAt: safeDateToISOString(s.updatedAt),
  }));

  const output: GetSubspacesBySpaceSlugStructuredContent = {
    spaceFound: true,
    slug,
    parentSpace: {
      id: space.id,
      slug: space.slug,
      title: space.title,
    },
    subspaces,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found ${subspaces.length} subspace(s) for "${space.title}" (${space.slug}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetSubspacesBySpaceSlugTool(server: McpServer): void {
  server.registerTool(
    'get_subspaces_by_space_slug',
    {
      title: 'Get Subspaces By Space Slug',
      description:
        'Returns direct child spaces (subspaces) for a Hypha space identified by slug.',
      inputSchema: getSubspacesBySpaceSlugInputSchema,
      outputSchema: getSubspacesBySpaceSlugOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetSubspacesBySpaceSlug,
  );
}
