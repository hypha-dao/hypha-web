import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerGetSpaceBySlugTool } from '@hypha-platform/mcp-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'hypha-web-mcp-server',
    version: '1.0.0',
  });

  registerGetSpaceBySlugTool(server);

  return server;
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = createMcpServer();

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    console.error('Error handling MCP request:', error);
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
