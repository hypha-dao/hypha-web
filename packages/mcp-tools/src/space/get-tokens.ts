import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findAllTokens } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

export const getTokensInputSchema = {
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

export const getTokensOutputSchema = z
  .object({
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

type GetTokensStructuredContent = z.infer<typeof getTokensOutputSchema>;

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

export async function handleGetTokens({
  search,
  limit,
}: {
  search?: string;
  limit?: number;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetTokensStructuredContent;
}> {
  const appliedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT) as number;

  const rows = await findAllTokens(
    { db },
    {
      search: search?.length ? search : undefined,
      limit: appliedLimit,
    },
  );

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

  const output: GetTokensStructuredContent = {
    tokens,
    appliedLimit,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found ${tokens.length} token(s) (limit ${appliedLimit}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetTokensTool(server: McpServer): void {
  server.registerTool(
    'get_tokens',
    {
      title: 'Get Tokens',
      description:
        'Lists Hypha tokens from the database with optional name/symbol search. Results are ordered by token name and capped by limit.',
      inputSchema: getTokensInputSchema,
      outputSchema: getTokensOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetTokens,
  );
}
