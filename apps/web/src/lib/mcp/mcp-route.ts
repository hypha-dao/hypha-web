// temp(mcp) #2559: resource-side wiring of the HTTP MCP endpoint (guard + handler), kept in small
// functions so moving the route to its own host later is a small change (a different env value).
import {
  AUTH_SERVER_SCOPES,
  guardResource,
  type AuthServerConfig,
  type AuthServerDisabled,
} from '@hypha-platform/auth-server/server';
import {
  bearerChallenge,
  handleMcpRequest,
  protectedResourceMetadata,
  type McpDeps,
} from '@hypha-platform/mcp-server/http';

export const MCP_PATH = '/api/mcp';
export const MCP_SCOPE = 'spaces:read';
export const MCP_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`;

type Config = AuthServerConfig | AuthServerDisabled;
type Keys = Parameters<typeof guardResource>[2]['keys'];

export type McpRouteOptions = {
  getConfig: () => Config;
  deps: () => McpDeps;
  /** Tests only: signing keys of the issuer. Default is the issuer's own key set. */
  keys?: Keys;
};

/**
 * The audience of this endpoint: the configured resource that ends in `/api/mcp`, preferring the
 * one on the host the request came to. Nothing is taken from request headers into the answer.
 */
export function mcpResource(
  config: AuthServerConfig,
  request: Request,
): string | undefined {
  const all = config.resources.filter((r) => r.endsWith(MCP_PATH));
  const host = new URL(request.url).host;
  return all.find((r) => new URL(r).host === host) ?? all[0];
}

const noStore = { 'cache-control': 'no-store' };

function problem(
  status: number,
  error: string,
  metadataUrl: string,
  challenge?: { error?: string; scope?: string },
) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'content-type': 'application/json',
      'www-authenticate': bearerChallenge(metadataUrl, challenge),
      ...noStore,
    },
  });
}

/** Every request: signature, issuer, exact audience, whitelist, scope. Never cached. */
export async function authorizeMcp(
  request: Request,
  config: AuthServerConfig,
  resource: string,
  keys?: Keys,
): Promise<{ ok: true; sub: string } | { ok: false; response: Response }> {
  const metadataUrl = `${new URL(resource).origin}${MCP_METADATA_PATH}`;
  const guard = await guardResource(request, config, {
    audience: resource,
    scope: MCP_SCOPE,
    keys,
  });
  if (guard.ok) return { ok: true, sub: guard.caller.sub };
  const { error } = (await guard.response
    .clone()
    .json()
    .catch(() => ({}))) as { error?: string };
  const status = guard.response.status;
  const response =
    // No token at all: a bare challenge that points at the metadata, as the MCP spec asks.
    error === 'invalid_request'
      ? problem(401, 'unauthorized', metadataUrl)
      : error === 'insufficient_scope'
      ? problem(403, error, metadataUrl, { error, scope: MCP_SCOPE })
      : problem(
          status === 403 ? 403 : 401,
          error ?? 'invalid_token',
          metadataUrl,
          { error: error ?? 'invalid_token' },
        );
  return { ok: false, response };
}

export function createMcpRoute(options: McpRouteOptions) {
  async function authorized(
    request: Request,
  ): Promise<{ sub: string } | { sub?: undefined; response: Response }> {
    const config = options.getConfig();
    if (!config.enabled) return { response: notFound() };
    const resource = mcpResource(config, request);
    if (!resource) return { response: notFound() };
    const auth = await authorizeMcp(request, config, resource, options.keys);
    return auth.ok ? { sub: auth.sub } : { response: auth.response };
  }

  async function POST(request: Request): Promise<Response> {
    const auth = await authorized(request);
    if (auth.sub === undefined) return auth.response;
    // Only `sub` crosses into the handler: the token itself never leaves the route.
    const response = await handleMcpRequest(request, auth.sub, options.deps());
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  }

  /** Stateless server: no event stream and no sessions to close. Still authenticated first. */
  async function notSupported(request: Request): Promise<Response> {
    const auth = await authorized(request);
    if (auth.sub === undefined) return auth.response;
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: {
        allow: 'POST',
        'content-type': 'application/json',
        ...noStore,
      },
    });
  }

  async function metadata(request: Request): Promise<Response> {
    const config = options.getConfig();
    if (!config.enabled) return notFound();
    const resource = mcpResource(config, request);
    if (!resource) return notFound();
    return new Response(
      JSON.stringify(
        protectedResourceMetadata({
          resource,
          issuer: config.issuer,
          // What the authorization server can grant, not only what this endpoint requires: clients ask
          // for the advertised scopes, and the consent page decides what the person ticks.
          scopes: AUTH_SERVER_SCOPES,
        }),
      ),
      {
        headers: {
          'content-type': 'application/json',
          // Public document, like the authorization server's own metadata.
          'access-control-allow-origin': '*',
          ...noStore,
        },
      },
    );
  }

  return { POST, GET: notSupported, DELETE: notSupported, metadata };
}

function notFound() {
  return new Response('Not Found', { status: 404 });
}
