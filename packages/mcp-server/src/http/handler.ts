import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createHyphaMcpServer, type McpDeps } from './server';

/**
 * Handles one MCP request (Streamable HTTP, stateless, JSON responses) for an already verified
 * caller. Authentication is the caller's job (the route); this never sees the bearer token.
 */
export async function handleMcpRequest(
  request: Request,
  sub: string,
  deps: McpDeps,
): Promise<Response> {
  const server = createHyphaMcpServer(sub, deps);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // JSON mode: the response is complete when handleRequest resolves.
    await server.close().catch(() => undefined);
  }
}

/** Public document that tells an MCP client which authorization server to use (RFC 9728). */
export function protectedResourceMetadata(input: {
  resource: string;
  issuer: string;
  scopes: readonly string[];
}) {
  return {
    resource: input.resource,
    authorization_servers: [input.issuer],
    scopes_supported: [...input.scopes],
    bearer_methods_supported: ['header'],
  };
}

/** `WWW-Authenticate` challenge that points an MCP client at the metadata (MCP spec). */
export function bearerChallenge(
  metadataUrl: string,
  extra?: { error?: string; scope?: string },
) {
  return (
    `Bearer resource_metadata="${metadataUrl}"` +
    (extra?.error ? `, error="${extra.error}"` : '') +
    (extra?.scope ? `, scope="${extra.scope}"` : '')
  );
}
