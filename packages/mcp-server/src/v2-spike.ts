import 'server-only';

// SPIKE (hypha-web#2559): local stdio MCP server over the v2 read builders.
// Throwaway: not meant to merge.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { db } from '@hypha-platform/storage-postgres';
import {
  authenticateIntegrationClient,
  buildDocumentsListV2,
  buildMyMembershipV2,
  buildMyVoteV2,
  buildSpaceV2,
  buildSpacesListV2,
  resolveV2Caller,
} from '@hypha-platform/core/server';

type Failure = { ok: false; status: number; error: string; message?: string };

const server = new McpServer(
  { name: 'hypha-v2-spike', version: '0.0.0' },
  {
    instructions:
      'Read-only Hypha v2 tools. Needs HYPHA_V2_CLIENT_KEY. Without HYPHA_V2_USER_TOKEN the caller is a guest (PUBLIC data only); with it, results follow that user.',
  },
);

/**
 * Same gate as the HTTP routes: the client key (HYPHA_V2_CLIENT_KEY) is always
 * required; the user token (HYPHA_V2_USER_TOKEN) is optional. Both come from the
 * MCP host's env and are never logged.
 */
async function caller() {
  const clientKey = process.env.HYPHA_V2_CLIENT_KEY?.trim();
  const clientAuth = await authenticateIntegrationClient(
    {
      request: new Request('http://localhost/mcp-spike', {
        headers: clientKey ? { 'x-hypha-client-key': clientKey } : {},
      }),
    },
    { db },
  );
  if (!clientAuth.ok) {
    return {
      ok: false as const,
      status: clientAuth.status,
      error: clientAuth.error,
    };
  }
  const token = process.env.HYPHA_V2_USER_TOKEN?.trim();
  return resolveV2Caller(token ? `Bearer ${token}` : null, { db });
}

function text(value: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    ...(isError && { isError: true }),
  };
}

function result(r: { ok: true; body: unknown } | Failure) {
  return r.ok
    ? text(r.body)
    : text({ error: r.error, message: r.message, status: r.status }, true);
}

async function run(
  fn: (c: Extract<Awaited<ReturnType<typeof caller>>, { ok: true }>['caller']) => Promise<
    { ok: true; body: unknown } | Failure
  >,
) {
  try {
    const c = await caller();
    if (!c.ok) return result(c);
    return result(await fn(c.caller));
  } catch (error) {
    console.error('[v2-spike] tool failed', error);
    return text({ error: 'Tool failed' }, true);
  }
}

const include = z
  .string()
  .optional()
  .describe('Comma-separated include blocks, as in the v2 API');

server.registerTool(
  'list_spaces',
  {
    description: 'List the spaces the caller may see (v2 viewer-aware list).',
    inputSchema: {
      slugs: z.array(z.string()).optional(),
      parentOnly: z.boolean().optional(),
      omitArchived: z.boolean().optional(),
      omitSandbox: z.boolean().optional(),
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
      include: include.describe('visibility,governance'),
    },
  },
  (a) =>
    run((c) =>
      buildSpacesListV2(
        { ...a, include: a.include ?? null } as never,
        c,
        { db },
      ),
    ),
);

server.registerTool(
  'get_space',
  {
    description: 'Get one space by slug.',
    inputSchema: { slug: z.string(), include: include.describe('visibility,governance,counts') },
  },
  (a) =>
    run((c) =>
      buildSpaceV2({ slug: a.slug, caller: c, include: a.include ?? null }, { db }),
    ),
);

server.registerTool(
  'list_documents',
  {
    description: 'List the documents (proposals/agreements) of a space.',
    inputSchema: {
      spaceSlug: z.string(),
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
      state: z.string().optional(),
      searchTerm: z.string().optional(),
      include: include.describe('tally'),
    },
  },
  (a) =>
    run((c) =>
      buildDocumentsListV2(
        {
          spaceSlug: a.spaceSlug,
          page: a.page ?? 1,
          pageSize: a.pageSize,
          state: a.state ?? null,
          searchTerm: a.searchTerm,
          include: a.include ?? null,
        } as never,
        c,
        { db },
      ),
    ),
);

server.registerTool(
  'get_my_membership',
  {
    description: "The token user's membership/delegate status in a space. Needs HYPHA_V2_USER_TOKEN.",
    inputSchema: { spaceSlug: z.string() },
  },
  (a) => run((c) => buildMyMembershipV2({ spaceSlug: a.spaceSlug, caller: c }, { db })),
);

server.registerTool(
  'get_my_vote',
  {
    description: "The token user's vote state on a document. Needs HYPHA_V2_USER_TOKEN.",
    inputSchema: { spaceSlug: z.string(), documentSlug: z.string() },
  },
  (a) =>
    run((c) =>
      buildMyVoteV2(
        { spaceSlug: a.spaceSlug, documentSlug: a.documentSlug, caller: c },
        { db },
      ),
    ),
);

server.connect(new StdioServerTransport()).catch((err: unknown) => {
  console.error('[v2-spike] failed to start', err);
  process.exit(1);
});
