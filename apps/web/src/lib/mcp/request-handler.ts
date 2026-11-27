import { createMcpHandler } from '@modelcontextprotocol/server';
import type { VerifiedClaims } from '@hypha-platform/core/server';
import { mcpRoute } from './headers';
import {
  consoleLogger,
  createHyphaMcpServer,
  WRITE_SCOPE_MESSAGE,
  WRITE_TOOL_SCOPES,
  type McpAccess,
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
import { MCP_SCOPE, type McpConfig } from './config';

export type McpRequestDeps = {
  getConfig(): McpConfig;
  resolve(claims: VerifiedClaims): Promise<ResolveResult>;
  features: McpFeatures;
  spaceUrl(slug: string): string;
  proposalUrl(spaceSlug: string, proposalSlug: string): string;
  signalUrl(spaceSlug: string, signalSlug: string): string;
  questUrl(spaceSlug: string, questSlug: string): string;
  slot?: RateSlot;
  /** Test seam: the issuer's key set. */
  keys?: AuthorizeDeps['keys'];
  log?: (entry: ToolCallLog) => void;
  deadlineMs?: number;
  /** The platform's post-response hook (Next `after`), for writes that outlive the deadline. */
  keepAlive?: (work: Promise<unknown>) => void;
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

/** Names of the tools a JSON-RPC request calls (a single message or a batch); none if unreadable. */
async function calledToolNames(request: Request): Promise<string[]> {
  if (request.method !== 'POST') return [];
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return [];
  }
  const messages = Array.isArray(body) ? body : [body];
  const names: string[] = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const { method, params } = message as {
      method?: unknown;
      params?: unknown;
    };
    const name = (params as { name?: unknown } | null | undefined)?.name;
    if (method === 'tools/call' && typeof name === 'string') names.push(name);
  }
  return names;
}

/**
 * The write tool a call names whose scope the token lacks, or null. A write tool called with a
 * token that lacks its scope
 * gets an HTTP 403 `insufficient_scope` naming the scopes to ask for (the MCP step-up), not a tool
 * error: the client acts on the status, and may re-authorize. Only while writes are on (otherwise
 * the tool does not exist and the server answers as for any unknown tool).
 */
async function missingWriteScope(
  request: Request,
  access: McpAccess,
): Promise<{ tool: string; scope: string } | null> {
  if (access.kind !== 'caller') return null;
  const granted = access.caller.via?.scopes ?? [];
  for (const name of await calledToolNames(request)) {
    const needed = (WRITE_TOOL_SCOPES as Record<string, string | undefined>)[
      name
    ];
    if (needed && !granted.includes(needed))
      return { tool: name, scope: needed };
  }
  return null;
}

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

    if (active.writesEnabled) {
      const needed = await missingWriteScope(request, authorized.access);
      if (needed) {
        // A refused write still gets its audit line (ids only, never the arguments).
        const person =
          authorized.access.kind === 'caller'
            ? { personId: authorized.access.caller.person.id }
            : {};
        (deps.log ?? consoleLogger)({
          tool: needed.tool,
          outcome: 'insufficient_scope',
          durationMs: 0,
          clientId: authorized.clientId,
          write: person,
        });
        return json(
          403,
          { error: 'insufficient_scope', message: WRITE_SCOPE_MESSAGE },
          {
            'www-authenticate': `Bearer error="insufficient_scope", scope="${MCP_SCOPE} ${needed.scope}", resource_metadata="${active.resourceMetadataUrl}"`,
          },
        );
      }
    }

    const handler = createMcpHandler(
      () =>
        createHyphaMcpServer({
          access: authorized.access,
          features: deps.features,
          spaceUrl: deps.spaceUrl,
          proposalUrl: deps.proposalUrl,
          signalUrl: deps.signalUrl,
          questUrl: deps.questUrl,
          log: deps.log ?? consoleLogger,
          deadlineMs: deps.deadlineMs,
          clientId: authorized.clientId,
          writesEnabled: active.writesEnabled,
          keepAlive: deps.keepAlive,
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
      scopes_supported: [...active.scopesSupported],
      bearer_methods_supported: ['header'],
      resource_name: 'Hypha',
    });
  });

  return { mcp, metadata };
}
