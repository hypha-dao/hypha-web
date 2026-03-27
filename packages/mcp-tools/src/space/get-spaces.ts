import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findAllSpaces } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export const getSpacesInputSchema = {
  search: z
    .string()
    .trim()
    .optional()
    .describe('Optional search across space title and description'),
  parentOnly: z
    .boolean()
    .optional()
    .describe(
      'When true (default), only top-level spaces are returned (no subspaces)',
    ),
  omitSandbox: z
    .boolean()
    .optional()
    .describe('When true, spaces flagged as sandbox are excluded'),
  omitArchived: z
    .boolean()
    .optional()
    .describe('When true, spaces flagged as archived are excluded'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(
      `Maximum spaces to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`,
    ),
};

export const getSpacesOutputSchema = z
  .object({
    spaces: z.array(
      z
        .object({
          id: z.number(),
          logoUrl: z.string().nullable(),
          leadImage: z.string().nullable(),
          title: z.string(),
          description: z.string(),
          slug: z.string(),
          web3SpaceId: z.number().nullable(),
          links: z.array(z.string()),
          categories: z.array(z.string()),
          parentId: z.number().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          address: z.string().nullable(),
          flags: z.array(z.string()),
        })
        .strict(),
    ),
    appliedLimit: z.number().int().min(1).max(MAX_LIMIT),
  })
  .strict();

type GetSpacesStructuredContent = z.infer<typeof getSpacesOutputSchema>;

function safeDateToISOString(value: unknown): string {
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return new Date(0).toISOString();
  }
  return candidate.toISOString();
}

function mapCategories(categories: unknown): string[] {
  if (!Array.isArray(categories)) return [];
  return categories.map((c) => String(c));
}

function mapFlags(flags: unknown): string[] {
  if (!Array.isArray(flags)) return [];
  return flags.map((f) => String(f));
}

export async function handleGetSpaces({
  search,
  parentOnly,
  omitSandbox,
  omitArchived,
  limit,
}: {
  search?: string;
  parentOnly?: boolean;
  omitSandbox?: boolean;
  omitArchived?: boolean;
  limit?: number;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetSpacesStructuredContent;
}> {
  const appliedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT) as number;

  const rows = await findAllSpaces(
    { db },
    {
      search: search?.length ? search : undefined,
      parentOnly: parentOnly ?? true,
      omitSandbox: omitSandbox ?? false,
      omitArchived: omitArchived ?? false,
      limit: appliedLimit,
    },
  );

  const spaces = rows.map((row) => ({
    id: row.id,
    logoUrl: row.logoUrl ?? null,
    leadImage: row.leadImage ?? null,
    title: row.title,
    description: row.description,
    slug: row.slug,
    web3SpaceId: row.web3SpaceId ?? null,
    links: Array.isArray(row.links) ? row.links.map(String) : [],
    categories: mapCategories(row.categories),
    parentId: row.parentId ?? null,
    createdAt: safeDateToISOString(row.createdAt),
    updatedAt: safeDateToISOString(row.updatedAt),
    address: row.address ?? null,
    flags: mapFlags(row.flags),
  }));

  const output: GetSpacesStructuredContent = {
    spaces,
    appliedLimit,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found ${spaces.length} space(s) (limit ${appliedLimit}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetSpacesTool(server: McpServer): void {
  server.registerTool(
    'get_spaces',
    {
      title: 'Get Spaces',
      description:
        'Lists Hypha spaces with optional search and filters. Results are ordered by title and capped by limit.',
      inputSchema: getSpacesInputSchema,
      outputSchema: getSpacesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetSpaces,
  );
}
