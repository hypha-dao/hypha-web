import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  registerGetSpaceBySlugTool,
  registerGetSpaceProposalsBySpaceSlugTool,
} from '@hypha-platform/mcp-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MCP_AUTH_HEADER = 'x-hypha-mcp-token';

function isAuthorizedRequest(request: Request): boolean {
  const configuredToken = process.env.HYPHA_MCP_AUTH_TOKEN;

  // Auth is optional by default to preserve local/dev velocity.
  if (!configuredToken) {
    return true;
  }

  const providedToken = request.headers.get(MCP_AUTH_HEADER);
  return providedToken === configuredToken;
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'hypha-web-mcp-server',
    version: '1.0.0',
  });

  registerGetSpaceBySlugTool(server);
  registerGetSpaceProposalsBySpaceSlugTool(server);

  return server;
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (!isAuthorizedRequest(request)) {
    return Response.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized',
        },
        id: null,
      },
      { status: 401 },
    );
  }

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const start = Date.now();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = createMcpServer();

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    console.info('MCP request handled', {
      requestId,
      method: request.method,
      status: response.status,
      durationMs: Date.now() - start,
    });
    return response;
  } catch (error) {
    console.error('Error handling MCP request', {
      requestId,
      method: request.method,
      durationMs: Date.now() - start,
      error,
    });
    return Response.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      },
      { status: 500 },
    );
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  const isLikelyBrowserNavigation =
    request.headers.get('mcp-protocol-version') === null &&
    (request.headers.get('accept')?.includes('text/html') ?? false);

  if (isLikelyBrowserNavigation) {
    return Response.json({
      ok: true,
      message:
        'This is an MCP endpoint. Use an MCP client (for example Cursor), not a browser tab navigation.',
      endpoint: '/mcp',
      methods: ['POST', 'GET', 'DELETE'],
    });
  }

  return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
