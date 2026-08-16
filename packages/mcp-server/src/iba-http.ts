import 'server-only';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { db } from '@hypha-platform/storage-postgres';
import {
  authenticateSpaceApiKeyUnscoped,
  findSpaceById,
  looksLikeSpaceApiKey,
  SPACE_API_KEY_HEADER,
  spaceApiKeySatisfiesScope,
} from '@hypha-platform/core/server';
import {
  createIbaMemoryToolContext,
  IBA_MEMORY_MCP_TOOLS,
} from './memory-tool-context';
import { registerMemoryIntelligenceTools } from './memory-tools';

export const IBA_MEMORY_MCP_NAME = 'hypha-iba-mcp';
export const IBA_MEMORY_MCP_VERSION = '0.0.0';
export const IBA_MEMORY_MCP_TRANSPORT = 'streamable-http';

export { IBA_MEMORY_MCP_TOOLS };

export function ibaMemoryMcpHealth(): {
  name: string;
  version: string;
  protocol: 'mcp';
  transport: string;
  tools: readonly string[];
} {
  return {
    name: IBA_MEMORY_MCP_NAME,
    version: IBA_MEMORY_MCP_VERSION,
    protocol: 'mcp',
    transport: IBA_MEMORY_MCP_TRANSPORT,
    tools: IBA_MEMORY_MCP_TOOLS,
  };
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

function presentedIbaApiKey(request: Request): string | undefined {
  const explicit = request.headers.get(SPACE_API_KEY_HEADER)?.trim();
  if (explicit) return explicit;
  const bearer = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (looksLikeSpaceApiKey(bearer)) return bearer;
  return undefined;
}

function createIbaMemoryMcpServer(input: {
  spaceSlug: string;
  sourceApp: string;
  scopes: readonly string[];
}): McpServer {
  const server = new McpServer(
    {
      name: IBA_MEMORY_MCP_NAME,
      version: IBA_MEMORY_MCP_VERSION,
    },
    {
      instructions:
        'IBA Space Intelligence MCP. Tools: memory.list, memory.search, memory.read, memory.create (draft only), memory.update (propose only), memory.delete (archive). space_slug may be omitted and is inferred from the API key. Do not publish to current.',
    },
  );
  registerMemoryIntelligenceTools(server, createIbaMemoryToolContext(input));
  return server;
}

/**
 * Hosted Streamable HTTP MCP for Intelligence Business Apps.
 * Authenticates a space API key per request; only memory.* tools are registered.
 */
export async function handleIbaMemoryMcpRequest(
  request: Request,
): Promise<Response> {
  if (!presentedIbaApiKey(request)) {
    return jsonError(
      401,
      `Missing API key. Send it in the ${SPACE_API_KEY_HEADER} header or as Bearer hyk_…`,
    );
  }

  const auth = await authenticateSpaceApiKeyUnscoped(request, { db });
  if (!auth.ok) {
    return jsonError(auth.status, auth.error);
  }

  if (!spaceApiKeySatisfiesScope(auth.apiKey.scopes, 'intelligence:read')) {
    return jsonError(
      403,
      'This API key is missing the "intelligence:read" scope.',
    );
  }

  const space = await findSpaceById({ id: auth.apiKey.spaceId }, { db });
  if (!space?.slug) {
    return jsonError(404, 'Space not found');
  }

  const server = createIbaMemoryMcpServer({
    spaceSlug: space.slug,
    sourceApp: auth.apiKey.source,
    scopes: auth.apiKey.scopes,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
