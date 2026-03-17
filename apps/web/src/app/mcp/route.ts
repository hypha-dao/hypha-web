import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getSpaceBySlugInputSchema = {
  slug: z
    .string()
    .trim()
    .min(1, 'Space slug is required')
    .describe('Hypha space slug, for example "hypha"'),
};

const getSpaceBySlugOutputSchema = z
  .object({
    found: z.boolean(),
    slug: z.string(),
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

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'hypha-web-mcp-server',
    version: '1.0.0',
  });

  server.registerTool(
    'get_space_by_slug',
    {
      title: 'Get Space By Slug',
      description:
        'Returns a single Hypha space and summary counts for members, documents, and subspaces.',
      inputSchema: getSpaceBySlugInputSchema,
      outputSchema: getSpaceBySlugOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ slug }) => {
      const space = await getSpaceBySlug({ slug });

      if (!space) {
        return {
          content: [
            {
              type: 'text',
              text: `No space found for slug "${slug}".`,
            },
          ],
          structuredContent: {
            found: false,
            slug,
            space: null,
          },
        };
      }

      const output = {
        found: true,
        slug,
        space: {
          id: space.id,
          slug: space.slug,
          title: space.title,
          description: space.description ?? null,
          parentId: space.parentId ?? null,
          web3SpaceId: space.web3SpaceId ?? null,
          memberCount:
            typeof space.memberCount === 'number'
              ? space.memberCount
              : Array.isArray(space.members)
              ? space.members.length
              : 0,
          documentCount:
            typeof space.documentCount === 'number'
              ? space.documentCount
              : Array.isArray(space.documents)
              ? space.documents.length
              : 0,
          subspaceCount: Array.isArray(space.subspaces)
            ? space.subspaces.length
            : 0,
          createdAt: new Date(space.createdAt).toISOString(),
          updatedAt: new Date(space.updatedAt).toISOString(),
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: `Found space "${output.space.title}" (${output.space.slug}).`,
          },
        ],
        structuredContent: output,
      };
    },
  );

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
