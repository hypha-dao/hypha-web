import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findAllTokens, findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const MCP_TOOLS_DEBUG = process.env.MCP_TOOLS_DEBUG === 'true';

export const getTokensBySpaceSlugInputSchema = {
  slug: z
    .string()
    .trim()
    .min(1, 'Space slug is required')
    .describe('Hypha space slug, for example "hypha"'),
  search: z
    .string()
    .trim()
    .optional()
    .describe('Optional search across token name and symbol'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(
      `Maximum tokens to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`,
    ),
};

export const getTokensBySpaceSlugOutputSchema = z
  .object({
    spaceFound: z.boolean(),
    slug: z.string(),
    tokens: z.array(
      z
        .object({
          id: z.number(),
          spaceId: z.number().nullable(),
          agreementId: z.number().nullable(),
          name: z.string(),
          symbol: z.string(),
          maxSupply: z.number(),
          type: z.string(),
          iconUrl: z.string().nullable(),
          transferable: z.boolean(),
          isVotingToken: z.boolean(),
          decayInterval: z.number().nullable(),
          decayPercentage: z.number().nullable(),
          createdAt: z.string().nullable(),
          documentCount: z.number(),
          address: z.string().nullable(),
          agreementWeb3Id: z.number().nullable(),
          referenceCurrency: z.string().nullable(),
          referencePrice: z.number().nullable(),
        })
        .strict(),
    ),
    appliedLimit: z.number().int().min(1).max(MAX_LIMIT),
  })
  .strict();

type GetTokensBySpaceSlugStructuredContent = z.infer<
  typeof getTokensBySpaceSlugOutputSchema
>;

function safeDateToISOString(value: unknown): string | null {
  if (value == null) return null;
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  return candidate.toISOString();
}

function normalizeFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function handleGetTokensBySpaceSlug({
  slug,
  search,
  limit,
}: {
  slug: string;
  search?: string;
  limit?: number;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetTokensBySpaceSlugStructuredContent;
}> {
  const startedAt = Date.now();
  const appliedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT) as number;

  if (MCP_TOOLS_DEBUG) {
    console.log('[mcp-tools][get_tokens_by_space_slug][start]', {
      slug,
      hasSearch: Boolean(search?.trim().length),
      limit,
      appliedLimit,
    });
  }

  const space = await findSpaceBySlug({ slug }, { db });

  if (!space) {
    const output: GetTokensBySpaceSlugStructuredContent = {
      spaceFound: false,
      slug,
      tokens: [],
      appliedLimit,
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

  const rows = await findAllTokens(
    { db },
    {
      spaceId: space.id,
      search: search?.length ? search : undefined,
      limit: appliedLimit,
    },
  );

  if (MCP_TOOLS_DEBUG) {
    console.log('[mcp-tools][get_tokens_by_space_slug][query-result]', {
      slug,
      spaceId: space.id,
      tokenRowCount: rows.length,
      durationMs: Date.now() - startedAt,
      search: search?.trim() || null,
      appliedLimit,
    });
  }

  const tokens = rows.map((row) => ({
    id: row.id,
    spaceId: row.spaceId ?? null,
    agreementId: row.agreementId ?? null,
    name: row.name,
    symbol: row.symbol,
    maxSupply: row.maxSupply,
    type: row.type,
    iconUrl: row.iconUrl ?? null,
    transferable: row.transferable,
    isVotingToken: row.isVotingToken,
    decayInterval: row.decayInterval ?? null,
    decayPercentage: row.decayPercentage ?? null,
    createdAt: safeDateToISOString(row.createdAt),
    documentCount: row.documentCount,
    address: row.address ?? null,
    agreementWeb3Id: row.agreementWeb3Id ?? null,
    referenceCurrency: row.referenceCurrency ?? null,
    referencePrice: normalizeFiniteNumber(row.referencePrice),
  }));

  const output: GetTokensBySpaceSlugStructuredContent = {
    spaceFound: true,
    slug,
    tokens,
    appliedLimit,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found ${tokens.length} token(s) for space "${space.title}" (${space.slug}) (limit ${appliedLimit}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetTokensBySpaceSlugTool(server: McpServer): void {
  server.registerTool(
    'get_tokens_by_space_slug',
    {
      title: 'Get Tokens By Space Slug',
      description:
        'Lists Hypha tokens for a specific space slug with optional name/symbol search. Results are ordered by token name and capped by limit.',
      inputSchema: getTokensBySpaceSlugInputSchema,
      outputSchema: getTokensBySpaceSlugOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetTokensBySpaceSlug,
  );
}
