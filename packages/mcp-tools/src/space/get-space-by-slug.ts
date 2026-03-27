import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import { z } from 'zod';

export const getSpaceBySlugInputSchema = {
  slug: z
    .string()
    .trim()
    .min(1, 'Space slug is required')
    .describe('Hypha space slug, for example "hypha"'),
};

export const getSpaceBySlugOutputSchema = z
  .object({
    found: z.boolean(),
    slug: z.string(),
    space: z
      .object({
        id: z.number(),
        slug: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        parentId: z.number().nullable(),
        web3SpaceId: z.number().nullable(),
        memberCount: z.number(),
        documentCount: z.number(),
        subspaceCount: z.number(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .nullable(),
  })
  .strict();

type GetSpaceBySlugStructuredContent = z.infer<
  typeof getSpaceBySlugOutputSchema
>;

function safeDateToISOString(value: unknown): string {
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return new Date(0).toISOString();
  }
  return candidate.toISOString();
}

function buildGetSpaceBySlugNotFoundResult(
  slug: string,
): GetSpaceBySlugStructuredContent {
  return {
    found: false,
    slug,
    space: null,
  };
}

function buildGetSpaceBySlugFoundResult(
  space: NonNullable<Awaited<ReturnType<typeof getSpaceBySlug>>>,
  slug: string,
): GetSpaceBySlugStructuredContent {
  return {
    found: true,
    slug,
    space: {
      id: space.id,
      slug: space.slug,
      title: space.title,
      description: space.description ?? null,
      parentId: space.parentId ?? null,
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
      createdAt: safeDateToISOString(space.createdAt),
      updatedAt: safeDateToISOString(space.updatedAt),
    },
  };
}

export async function handleGetSpaceBySlug({
  slug,
}: {
  slug: string;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetSpaceBySlugStructuredContent;
}> {
  const space = await getSpaceBySlug({ slug });

  if (!space) {
    const output = buildGetSpaceBySlugNotFoundResult(slug);

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

  const output = buildGetSpaceBySlugFoundResult(space, slug);

  return {
    content: [
      {
        type: 'text',
        text: `Found space "${space.title}" (${space.slug}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetSpaceBySlugTool(server: McpServer): void {
  server.registerTool(
    'get_space_by_slug',
    {
      title: 'Get Space By Slug',
      description:
        'Returns a single Hypha space and summary counts for members, documents, and subspaces.',
      inputSchema: getSpaceBySlugInputSchema,
      outputSchema: getSpaceBySlugOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetSpaceBySlug,
  );
}
