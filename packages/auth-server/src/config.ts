/**
 * Authorization server configuration. Everything is read from environment variables, once,
 * and the result is either "disabled (reason)" or a fully validated config. Fail closed:
 * anything missing or malformed leaves the server off.
 */

/** Scope vocabulary issued by this server. Kept in one place, shared with the resource side. */
export const AUTH_SERVER_SCOPES = [
  'spaces:read',
  'agreements:vote',
  'signals:write',
  'offline_access',
] as const;
export type AuthServerScope = (typeof AUTH_SERVER_SCOPES)[number];
/**
 * Scopes that let an app act (prepare votes, create signals), as opposed to read. For clients
 * that are not pre-approved the consent page shows them unticked, with a stronger warning.
 */
export const AUTH_SERVER_WRITE_SCOPES: readonly AuthServerScope[] = [
  'agreements:vote',
  'signals:write',
];
/**
 * Scopes a dynamically registered client may carry: the vocabulary as it was before
 * `signals:write`. Dynamic registration is unchanged by MCP writes (and off in production). The
 * registration guard drops anything else and narrows the stored row to it (`registration.ts`).
 */
export const DCR_ALLOWED_SCOPES: readonly AuthServerScope[] = [
  'spaces:read',
  'agreements:vote',
  'offline_access',
];
/**
 * Scopes a client identified by its metadata document (CIMD, for example Claude Code or ChatGPT)
 * may carry. Its host is proven, and write scopes are offered unticked, not capped (K73); the
 * MCP write scope is still accepted only while MCP writes are on (`scopesForChannel`).
 */
export const CIMD_ALLOWED_SCOPES: readonly AuthServerScope[] = [
  'spaces:read',
  'agreements:vote',
  'signals:write',
  'offline_access',
];
/**
 * The one list the library stores on every client it registers itself, DCR and CIMD alike (it
 * has no per-kind option): the union of both. Each kind is then held to its own list: DCR rows
 * are narrowed at registration, and consent offers and accepts only `scopesForClientKind`.
 */
export const CLIENT_REGISTRATION_CEILING_SCOPES: readonly AuthServerScope[] = [
  ...new Set([...DCR_ALLOWED_SCOPES, ...CIMD_ALLOWED_SCOPES]),
];

/**
 * The scopes a kind of client may be granted. A registered client is limited by its own row in
 * `as_oauth_client` (set by hand, not by code), which the library checks at authorization.
 */
export function scopesForClientKind(
  kind: 'registered' | 'cimd' | 'dcr',
): readonly string[] {
  if (kind === 'cimd') return CIMD_ALLOWED_SCOPES;
  if (kind === 'dcr') return DCR_ALLOWED_SCOPES;
  return AUTH_SERVER_SCOPES;
}
/**
 * Write scopes that start unticked for every client, pre-approved ones included: writing in a
 * person's name is a choice they make each time they connect an app.
 */
export const ALWAYS_UNTICKED_SCOPES: readonly AuthServerScope[] = [
  'signals:write',
];
/**
 * Scopes that act in the spaces chosen under `spaces:read` (the same per-space grant), so an
 * approval that includes one of them must include `spaces:read` too.
 */
export const SCOPES_REQUIRING_SPACES_READ: readonly AuthServerScope[] = [
  'signals:write',
];

/**
 * The channel a resource belongs to. Each channel has its own list of the scopes it accepts (the
 * support grid of the integration kit): the hosted MCP server is the configured resource whose
 * path is `/mcp`, the same rule the app uses to find its host; every other resource is the API.
 */
export type ResourceChannel = 'mcp' | 'api';

/** Scopes the hosted MCP resource accepts for reading (E52, P5). */
export const MCP_READ_SCOPES: readonly AuthServerScope[] = [
  'spaces:read',
  'offline_access',
];
/** Scopes the hosted MCP resource accepts only while MCP writes are switched on. */
export const MCP_WRITE_SCOPES: readonly AuthServerScope[] = ['signals:write'];
/** Scopes the API resource accepts: what it accepted before `signals:write` existed. */
export const API_RESOURCE_SCOPES: readonly AuthServerScope[] = [
  'spaces:read',
  'agreements:vote',
  'offline_access',
];

export function channelForResource(identifier: string): ResourceChannel {
  try {
    return new URL(identifier).pathname === '/mcp' ? 'mcp' : 'api';
  } catch {
    return 'api';
  }
}

/** The scopes a channel accepts now. MCP write scopes depend on the MCP write switch. */
export function scopesForChannel(
  channel: ResourceChannel,
  options: { mcpWritesEnabled: boolean },
): string[] {
  if (channel === 'api') return [...API_RESOURCE_SCOPES];
  return options.mcpWritesEnabled
    ? [...MCP_READ_SCOPES, ...MCP_WRITE_SCOPES]
    : [...MCP_READ_SCOPES];
}

/**
 * Allowed scopes declared for a resource identifier. The library intersects a request with them
 * at token time and at every refresh, and answers `invalid_scope` when nothing is left; the
 * consent page offers only these. Every resource has a list.
 */
export function allowedScopesForResource(
  identifier: string,
  options: { mcpWritesEnabled: boolean },
): string[] {
  return scopesForChannel(channelForResource(identifier), options);
}

/** Product defaults (reported for confirmation). Seconds. */
export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
/** Sliding: each refresh issues a new token valid for this long, so 90 days of inactivity ends the connection. */
export const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
/** Lifetime of an authorization code: it is exchanged by the app right after the redirect. */
export const AUTH_CODE_TTL_SECONDS = 60;
/**
 * How long the signed login/consent query stays valid: the time a person may take to sign in and
 * read the approval page. Separate from the code lifetime above. The library derives both from one
 * option (`codeExpiresIn`), so this value goes there and the 60 s code lifetime is enforced at the
 * token endpoint (see auth.ts, `hypha-code-ttl`).
 */
export const AUTH_QUERY_TTL_SECONDS = 10 * 60;
/**
 * Grace window for a rotated refresh token (K61): inside it the same refresh request gets the
 * same token response again, so requests in flight at a rotation do not log the person out.
 * After it, reuse revokes the whole family. Library option `refreshTokenReuseInterval`.
 */
export const REFRESH_TOKEN_REUSE_INTERVAL_SECONDS = 10;

/** Path prefix of the Better Auth handler (not the issuer: the issuer has no path). */
export const AUTH_SERVER_API_BASE_PATH = '/api/auth';
/** Path of the AS key set under the base path; `.json` so plain clients and caches treat it as JSON. */
export const AUTH_SERVER_JWKS_PATH = '/jwks.json';
export const AUTH_SERVER_LOGIN_PATH = '/auth/login';
export const AUTH_SERVER_CONSENT_PATH = '/auth/consent';
/**
 * Actions of the connected-apps page, under the API base path. Served by this package's handler,
 * never by the library (see `handleConnectedApps` in handler.ts).
 */
export const CONNECTED_APPS_DISCONNECT_PATH = '/connected-apps/disconnect';
export const CONNECTED_APPS_SPACES_PATH = '/connected-apps/spaces';

export type AuthServerConfig = {
  enabled: true;
  /** Path-less issuer, no trailing slash, e.g. https://auth.example.org */
  issuer: string;
  /** Host (with port) the server answers on. Every other host gets 404. */
  host: string;
  /** Secret that protects the signing keys at rest and signs the login/consent query. */
  secret: string;
  databaseUrl: string;
  privyAppId: string;
  /**
   * Local testing only: where to fetch Privy's public keys from. Ignored unless the issuer is a
   * localhost host and this is not a production build.
   */
  privyJwksUrlOverride?: string;
  allowedPersonIds: ReadonlySet<string>;
  /** Resource indicators (RFC 8707) access tokens may be issued for. */
  resources: readonly string[];
  /**
   * Browser origins allowed to call the token and registration endpoints cross-origin (dev
   * tools such as MCP Inspector). Exact origins, default empty. Metadata and JWKS are public
   * and answer any origin regardless of this list.
   */
  corsAllowedOrigins: readonly string[];
  /**
   * Dynamic client registration (RFC 7591, restricted in registration.ts). Off in code: only the
   * exact string "true" in AUTH_SERVER_DCR_ENABLED turns it on. Off means no `registration_endpoint`
   * in the metadata, the register path answers 404, and cross-origin access to it is not granted.
   */
  dcrEnabled: boolean;
  /**
   * MCP writes (`signals:write` on the `/mcp` resource). Off in code: only the exact string "true"
   * in MCP_WRITES_ENABLED turns it on. Separate from MCP_SERVER_ENABLED (reads) and from the MCP
   * kill switch. Off means the MCP resource does not accept the scope, so it is neither offered
   * on the consent page nor issued, and the next refresh of a token that has it drops it.
   */
  mcpWritesEnabled: boolean;
};

export type AuthServerDisabled = { enabled: false; reason: string };

type Env = Record<string, string | undefined>;

const LOCAL_HOSTNAME = /(^|\.)localhost$/;

export function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Exact origins only (scheme + host + port, no path); anything else is dropped. No wildcards. */
export function parseOrigins(value: string | undefined): string[] {
  const out = new Set<string>();
  for (const item of parseList(value)) {
    try {
      const url = new URL(item);
      if (
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        !url.hostname.includes('*') &&
        url.origin === item.replace(/\/$/, '')
      )
        out.add(url.origin);
    } catch {
      /* dropped */
    }
  }
  return [...out];
}

export function parseIssuer(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = LOCAL_HOSTNAME.test(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    return null;
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username) {
    return null;
  }
  return url.origin;
}

export function loadAuthServerConfig(
  env: Env = process.env,
): AuthServerConfig | AuthServerDisabled {
  // Kill switch: anything but the exact string "true" leaves the server off.
  if (env.AUTH_SERVER_ENABLED !== 'true') {
    return { enabled: false, reason: 'AUTH_SERVER_ENABLED is not "true"' };
  }
  // Production only. On Vercel, VERCEL_ENV is production | preview | development.
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    return { enabled: false, reason: 'not a production deployment' };
  }

  const issuer = parseIssuer(env.AUTH_SERVER_ISSUER ?? '');
  if (!issuer) {
    return {
      enabled: false,
      reason: 'AUTH_SERVER_ISSUER is missing or invalid',
    };
  }
  const secret = env.AUTH_SERVER_SECRET ?? '';
  if (secret.length < 32) {
    return {
      enabled: false,
      reason: 'AUTH_SERVER_SECRET is missing or too short',
    };
  }
  const databaseUrl = env.BRANCH_DB_URL || env.DEFAULT_DB_URL || '';
  if (!databaseUrl) {
    return { enabled: false, reason: 'database url is not set' };
  }
  const privyAppId = env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
  if (!privyAppId) {
    return { enabled: false, reason: 'Privy app id is not set' };
  }

  return {
    enabled: true,
    issuer,
    host: new URL(issuer).host,
    secret,
    databaseUrl,
    privyAppId,
    privyJwksUrlOverride:
      LOCAL_HOSTNAME.test(new URL(issuer).hostname) &&
      env.NODE_ENV !== 'production' &&
      env.AUTH_SERVER_DEV_PRIVY_JWKS_URL
        ? env.AUTH_SERVER_DEV_PRIVY_JWKS_URL
        : undefined,
    allowedPersonIds: new Set(parseList(env.AUTH_SERVER_ALLOWED_PERSON_IDS)),
    resources: parseList(env.AUTH_SERVER_RESOURCES),
    corsAllowedOrigins: parseOrigins(env.AUTH_SERVER_CORS_ORIGINS),
    dcrEnabled: env.AUTH_SERVER_DCR_ENABLED === 'true',
    mcpWritesEnabled: env.MCP_WRITES_ENABLED === 'true',
  };
}
