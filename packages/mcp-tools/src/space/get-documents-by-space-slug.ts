import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  findAllDocumentsBySpaceSlug,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { DirectionType } from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

const documentStateSchema = z.enum(['discussion', 'proposal', 'agreement']);

export const getDocumentsBySpaceSlugInputSchema = {
  slug: z
    .string()
    .trim()
    .min(1, 'Space slug is required')
    .describe('Hypha space slug, for example "hypha"'),
  page: z.number().int().min(1).optional().describe('Page number (1-based)'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .describe(`Page size (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE})`),
  state: documentStateSchema.optional().describe('Filter by document state'),
  searchTerm: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Full-text search on title and description'),
};

export const getDocumentsBySpaceSlugOutputSchema = z
  .object({
    spaceFound: z.boolean(),
    slug: z.string(),
    documents: z.array(
      z
        .object({
          id: z.number(),
          creatorId: z.number(),
          title: z.string(),
          description: z.string().optional(),
          slug: z.string().optional(),
          state: documentStateSchema,
          leadImage: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          web3ProposalId: z.number().nullable(),
          label: z.string(),
          creator: z
            .object({
              avatarUrl: z.string().optional(),
              name: z.string().optional(),
              surname: z.string().optional(),
              address: z.string().optional(),
              type: z.enum(['person', 'space']).optional(),
            })
            .optional(),
        })
        .strict(),
    ),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
      hasNextPage: z.boolean(),
      hasPreviousPage: z.boolean(),
    }),
  })
  .strict();

type GetDocumentsBySpaceSlugStructuredContent = z.infer<
  typeof getDocumentsBySpaceSlugOutputSchema
>;

function safeDateToISOString(value: unknown): string {
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return new Date(0).toISOString();
  }
  return candidate.toISOString();
}

export async function handleGetDocumentsBySpaceSlug({
  slug,
  page,
  pageSize,
  state,
  searchTerm,
}: {
  slug: string;
  page?: number;
  pageSize?: number;
  state?: z.infer<typeof documentStateSchema>;
  searchTerm?: string;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetDocumentsBySpaceSlugStructuredContent;
}> {
  const space = await findSpaceBySlug({ slug }, { db });

  if (!space) {
    const output: GetDocumentsBySpaceSlugStructuredContent = {
      spaceFound: false,
      slug,
      documents: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
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

  const resolvedPageSize = Math.min(
    pageSize ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const resolvedPage = page ?? 1;

  const result = await findAllDocumentsBySpaceSlug(
    { spaceSlug: slug },
    {
      db,
      pagination: {
        page: resolvedPage,
        pageSize: resolvedPageSize,
        order: [{ name: 'createdAt', dir: DirectionType.DESC }],
      },
      filter: state ? { state } : {},
      searchTerm: searchTerm?.length ? searchTerm : undefined,
    },
  );

  const documents = result.data.map((doc) => ({
    id: doc.id,
    creatorId: doc.creatorId,
    title: doc.title,
    description: doc.description,
    slug: doc.slug,
    state: doc.state as z.infer<typeof documentStateSchema>,
    leadImage: doc.leadImage ?? '',
    createdAt: safeDateToISOString(doc.createdAt),
    updatedAt: safeDateToISOString(doc.updatedAt),
    web3ProposalId: doc.web3ProposalId ?? null,
    label: doc.label ?? '',
    creator: doc.creator
      ? {
          avatarUrl: doc.creator.avatarUrl,
          name: doc.creator.name,
          surname: doc.creator.surname,
          address: doc.creator.address,
          type: doc.creator.type,
        }
      : undefined,
  }));

  const output: GetDocumentsBySpaceSlugStructuredContent = {
    spaceFound: true,
    slug,
    documents,
    pagination: result.pagination,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found ${result.pagination.total} document(s) for space "${space.title}" (${space.slug}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetDocumentsBySpaceSlugTool(server: McpServer): void {
  server.registerTool(
    'get_documents_by_space_slug',
    {
      title: 'Get Documents By Space Slug',
      description:
        'Returns paginated governance documents for a Hypha space identified by slug, with optional state filter and search.',
      inputSchema: getDocumentsBySpaceSlugInputSchema,
      outputSchema: getDocumentsBySpaceSlugOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetDocumentsBySpaceSlug,
  );
}
