import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findSpaceById, findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

export const getSpaceByIdInputSchema = {
  id: z
    .number()
    .int()
    .positive('Space ID must be a positive integer')
    .describe('Hypha space numeric ID'),
};

export const getSpaceByIdOutputSchema = z
  .object({
    found: z.boolean(),
    id: z.number(),
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

type GetSpaceByIdStructuredContent = z.infer<typeof getSpaceByIdOutputSchema>;

function safeDateToISOString(value: unknown): string {
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return new Date(0).toISOString();
  }
  return candidate.toISOString();
}

function buildGetSpaceByIdNotFoundResult(
  id: number,
): GetSpaceByIdStructuredContent {
  return {
    found: false,
    id,
    space: null,
  };
}

export async function handleGetSpaceById({ id }: { id: number }): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetSpaceByIdStructuredContent;
}> {
  const spaceById = await findSpaceById({ id }, { db });

  if (!spaceById) {
    const output = buildGetSpaceByIdNotFoundResult(id);

    return {
      content: [
        {
          type: 'text',
          text: `No space found for ID ${id}.`,
        },
      ],
      structuredContent: output,
    };
  }

  const spaceWithRelations = await findSpaceBySlug(
    { slug: spaceById.slug },
    { db },
  );

  const memberCount = spaceWithRelations?.members?.length ?? 0;
  const documentCount = spaceWithRelations?.documents?.length ?? 0;
  const subspaceCount = spaceWithRelations?.subspaces?.length ?? 0;

  const output: GetSpaceByIdStructuredContent = {
    found: true,
    id,
    space: {
      id: spaceById.id,
      slug: spaceById.slug,
      title: spaceById.title,
      description: spaceById.description ?? null,
      parentId: spaceById.parentId ?? null,
      web3SpaceId: spaceById.web3SpaceId ?? null,
      memberCount,
      documentCount,
      subspaceCount,
      createdAt: safeDateToISOString(spaceById.createdAt),
      updatedAt: safeDateToISOString(spaceById.updatedAt),
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found space "${spaceById.title}" (${spaceById.slug}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetSpaceByIdTool(server: McpServer): void {
  server.registerTool(
    'get_space_by_id',
    {
      title: 'Get Space By ID',
      description:
        'Returns a single Hypha space by numeric ID with summary counts for members, documents, and subspaces.',
      inputSchema: getSpaceByIdInputSchema,
      outputSchema: getSpaceByIdOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetSpaceById,
  );
}
