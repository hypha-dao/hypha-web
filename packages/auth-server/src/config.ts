/**
 * Authorization server configuration. Everything is read from environment variables, once,
 * and the result is either "disabled (reason)" or a fully validated config. Fail closed:
 * anything missing or malformed leaves the server off.
 */

/** Scope vocabulary issued by this server. Kept in one place, shared with the resource side. */
export const AUTH_SERVER_SCOPES = ['spaces:read', 'offline_access'] as const;
export type AuthServerScope = (typeof AUTH_SERVER_SCOPES)[number];

/** Product defaults (reported for confirmation). Seconds. */
export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
/** Sliding: each refresh issues a new token valid for this long, so 90 days of inactivity ends the connection. */
export const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
export const AUTH_CODE_TTL_SECONDS = 60;

/** Path prefix of the Better Auth handler (not the issuer: the issuer has no path). */
export const AUTH_SERVER_API_BASE_PATH = '/api/auth';
/** Path of the AS key set under the base path; `.json` so plain clients and caches treat it as JSON. */
export const AUTH_SERVER_JWKS_PATH = '/jwks.json';
export const AUTH_SERVER_LOGIN_PATH = '/auth/login';
export const AUTH_SERVER_CONSENT_PATH = '/auth/consent';

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
  };
}
