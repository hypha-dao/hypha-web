import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  findPeopleBySpaceSlug,
  findSpaceBySlug,
  type Person,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export const getPeopleBySpaceSlugInputSchema = {
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
};

export const getPeopleBySpaceSlugOutputSchema = z
  .object({
    spaceFound: z.boolean(),
    slug: z.string(),
    people: z.array(
      z
        .object({
          id: z.number(),
          slug: z.string().optional(),
          name: z.string().optional(),
          surname: z.string().optional(),
          email: z.string().optional(),
          nickname: z.string().optional(),
          avatarUrl: z.string().optional(),
          leadImageUrl: z.string().optional(),
          description: z.string().optional(),
          location: z.string().optional(),
          address: z.string().optional(),
          createdAt: z.string(),
          updatedAt: z.string(),
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

type GetPeopleBySpaceSlugStructuredContent = z.infer<
  typeof getPeopleBySpaceSlugOutputSchema
>;

function safeDateToISOString(value: unknown): string {
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return new Date(0).toISOString();
  }
  return candidate.toISOString();
}

function mapPerson(person: Person) {
  return {
    id: person.id,
    slug: person.slug,
    name: person.name,
    surname: person.surname,
    email: person.email,
    nickname: person.nickname,
    avatarUrl: person.avatarUrl,
    leadImageUrl: person.leadImageUrl,
    description: person.description,
    location: person.location,
    address: person.address,
    createdAt: safeDateToISOString(person.createdAt),
    updatedAt: safeDateToISOString(person.updatedAt),
  };
}

export async function handleGetPeopleBySpaceSlug({
  slug,
  page,
  pageSize,
}: {
  slug: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetPeopleBySpaceSlugStructuredContent;
}> {
  const space = await findSpaceBySlug({ slug }, { db });

  if (!space) {
    const output: GetPeopleBySpaceSlugStructuredContent = {
      spaceFound: false,
      slug,
      people: [],
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

  const result = await findPeopleBySpaceSlug(
    { spaceSlug: slug },
    {
      db,
      pagination: { page: resolvedPage, pageSize: resolvedPageSize },
    },
  );

  const people = result.data.map((p) => mapPerson(p));

  const output: GetPeopleBySpaceSlugStructuredContent = {
    spaceFound: true,
    slug,
    people,
    pagination: result.pagination,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found ${result.pagination.total} member(s) in space "${space.title}" (${space.slug}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetPeopleBySpaceSlugTool(server: McpServer): void {
  server.registerTool(
    'get_people_by_space_slug',
    {
      title: 'Get People By Space Slug',
      description:
        'Returns paginated people (members) for a Hypha space identified by slug.',
      inputSchema: getPeopleBySpaceSlugInputSchema,
      outputSchema: getPeopleBySpaceSlugOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetPeopleBySpaceSlug,
  );
}
