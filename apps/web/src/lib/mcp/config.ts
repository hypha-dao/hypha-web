/**
 * Configuration of the hosted MCP server, read from the environment once per server instance.
 *
 * - `MCP_SERVER_ENABLED`: only the exact string "true" turns the server on (off by default).
 * - `MCP_SERVER_KILL_SWITCH`: the exact string "true" turns it off again at once, with the
 *   clear "temporarily unavailable" answer (E8).
 * - Production only: on Vercel any `VERCEL_ENV` other than `production` is off (Preview shares
 *   production Privy and data, D44).
 * - The resource URL is the entry of `AUTH_SERVER_RESOURCES` that ends in `/mcp` (frozen
 *   before the first run, D45); the server answers on that host only and the access token must
 *   have been issued for exactly that string.
 */
export const MCP_SCOPE = 'spaces:read';
export const MCP_DEFAULT_HOST = 'mcp.hypha.earth';
export const MCP_METADATA_PATH = '/.well-known/oauth-protected-resource/mcp';

type Env = Record<string, string | undefined>;

/** The parts of the authorization server's configuration the MCP needs. */
export type AuthServerView =
  | {
      enabled: true;
      issuer: string;
      resources: readonly string[];
      allowedPersonIds: ReadonlySet<string>;
      /**
       * The scopes the authorization server accepts for a resource now (its channel list).
       * Asked for the resource this server selected, so `scopes_supported` is exactly what a
       * token for it can carry.
       */
      scopesForResource: (resource: string) => readonly string[];
      /**
       * `MCP_WRITES_ENABLED`, read by the authorization server: the one switch for both the
       * write scope and the write tools, so the two can never disagree.
       */
      writesEnabled: boolean;
    }
  | { enabled: false };

export type McpConfig = {
  /** Host the server answers on; every other host gets a plain 404. */
  host: string;
  /** Present when the server is on. */
  active: {
    audience: string;
    issuer: string;
    resourceMetadataUrl: string;
    allowedPersonIds: ReadonlySet<string>;
    scopesSupported: readonly string[];
    /** Write tools are listed and callable (with the write scope) only while this is true. */
    writesEnabled: boolean;
  } | null;
  /** Why it is off (operator log only, never shown to a caller). */
  reason?: string;
};

export function loadMcpConfig(env: Env, as: AuthServerView): McpConfig {
  const audience = as.enabled
    ? as.resources.find((r) => r.endsWith('/mcp'))
    : undefined;
  let host = MCP_DEFAULT_HOST;
  let origin = `https://${MCP_DEFAULT_HOST}`;
  if (audience) {
    try {
      const url = new URL(audience);
      host = url.host;
      origin = url.origin;
    } catch {
      // keep the defaults; the server stays off below
    }
  }
  const off = (reason: string): McpConfig => ({ host, active: null, reason });

  if (env.MCP_SERVER_ENABLED !== 'true')
    return off('MCP_SERVER_ENABLED is not "true"');
  if (env.MCP_SERVER_KILL_SWITCH === 'true') return off('kill switch is on');
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    return off('not a production deployment');
  }
  if (!as.enabled) return off('the authorization server is off');
  if (!audience) return off('AUTH_SERVER_RESOURCES has no /mcp resource');
  try {
    new URL(audience);
  } catch {
    return off('the /mcp resource is not a valid URL');
  }

  return {
    host,
    active: {
      audience,
      issuer: as.issuer,
      resourceMetadataUrl: `${origin}${MCP_METADATA_PATH}`,
      allowedPersonIds: as.allowedPersonIds,
      scopesSupported: [...as.scopesForResource(audience)],
      writesEnabled: as.writesEnabled,
    },
  };
}
