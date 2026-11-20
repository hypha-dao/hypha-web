import { createMcpHandler } from '@modelcontextprotocol/server';
import type { VerifiedClaims } from '@hypha-platform/core/server';
import { mcpRoute } from './headers';
import {
  consoleLogger,
  createHyphaMcpServer,
  type McpFeatures,
  type ToolCallLog,
} from '@hypha-platform/mcp';
import {
  authorizeRequest,
  type AuthorizeDeps,
  type RateSlot,
  type ResolveResult,
  type Surface,
} from '../authorize-request';
import { MCP_SCOPE, MCP_SUPPORTED_SCOPES, type McpConfig } from './config';

export type McpRequestDeps = {
  getConfig(): McpConfig;
  resolve(claims: VerifiedClaims): Promise<ResolveResult>;
  features: McpFeatures;
  spaceUrl(slug: string): string;
  slot?: RateSlot;
  /** Test seam: the issuer's key set. */
  keys?: AuthorizeDeps['keys'];
  log?: (entry: ToolCallLog) => void;
  deadlineMs?: number;
};

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const notFound = () => new Response('Not found', { status: 404 });

/** The "temporarily unavailable" answer: server off, kill switch, or not yet enabled (E8). */
const unavailable = () =>
  json(
    503,
    {
      error: 'temporarily_unavailable',
      message: 'MCP is temporarily unavailable.',
    },
    { 'retry-after': '300' },
  );

function hostOf(request: Request): string {
  return (
    request.headers.get('host') ?? new URL(request.url).host
  ).toLowerCase();
}

/**
 * Builds the two request handlers of the hosted MCP server: the MCP endpoint and the
 * protected-resource metadata. Every answer, errors included, carries the response headers
 * (`mcpRoute`); the route files call these and build no response themselves.
 */
export function createMcpRequestHandlers(deps: McpRequestDeps) {
  const unhandled = () => json(500, { error: 'server_error' });
  const wrap = <A extends unknown[]>(
    handler: (...args: A) => Promise<Response>,
  ) => mcpRoute(handler, unhandled);

  type Gate =
    | { response: Response }
    | { response?: undefined; active: NonNullable<McpConfig['active']> };
  const gate = (request: Request): Gate => {
    const config = deps.getConfig();
    // 404 on any host but its own: the server does not exist anywhere else.
    if (hostOf(request) !== config.host.toLowerCase())
      return { response: notFound() };
    if (!config.active) return { response: unavailable() };
    return { active: config.active };
  };

  const mcp = wrap(async (request: Request): Promise<Response> => {
    const gated = gate(request);
    if (gated.response) return gated.response;
    const { active } = gated;

    // E22: no CORS, and a browser Origin is not on the (empty) allow-list. Native MCP
    // clients send no Origin.
    if (request.headers.get('origin')) {
      return json(403, { error: 'forbidden_origin' });
    }

    const surface: Surface = {
      audience: active.audience,
      scope: MCP_SCOPE,
      resourceMetadataUrl: active.resourceMetadataUrl,
    };
    const authorized = await authorizeRequest(request, surface, {
      config: {
        issuer: active.issuer,
        allowedPersonIds: active.allowedPersonIds,
      },
      keys: deps.keys,
      resolve: deps.resolve,
      slot: deps.slot,
    });
    if (!authorized.ok) return authorized.response;

    const handler = createMcpHandler(
      () =>
        createHyphaMcpServer({
          access: authorized.access,
          features: deps.features,
          spaceUrl: deps.spaceUrl,
          log: deps.log ?? consoleLogger,
          deadlineMs: deps.deadlineMs,
          clientId: authorized.clientId,
        }),
      // Modern clients only (D34); never stream (no progress messages in this release).
      { legacy: 'reject', responseMode: 'json' },
    );
    return handler.fetch(request);
  });

  const metadata = wrap(async (request: Request): Promise<Response> => {
    const gated = gate(request);
    if (gated.response) return gated.response;
    const { active } = gated;
    return json(200, {
      resource: active.audience,
      authorization_servers: [active.issuer],
      scopes_supported: [...MCP_SUPPORTED_SCOPES],
      bearer_methods_supported: ['header'],
      resource_name: 'Hypha',
    });
  });

  return { mcp, metadata };
}
