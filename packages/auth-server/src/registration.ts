import { createHash } from 'node:crypto';
import { AUTH_SERVER_SCOPES } from './config';
import type { AuthDbPool } from './db';
import { redactingLog } from './redact';

/**
 * Dynamic client registration (RFC 7591), restricted. EXPERIMENT (#2608 DCR): lets a standard
 * MCP host register itself without a pre-shared document. Everything the library would accept
 * beyond this profile is refused or dropped here, before the request reaches Better Auth.
 *
 * Profile: anonymous, public clients only (no secret is ever issued), grants authorization_code
 * and refresh_token, response type code, https or loopback-http redirect URIs, scopes inside the
 * server vocabulary (default spaces:read). Registered clients are always unverified and consent
 * is remembered per client and scope like for any client (skip_consent cannot be set: it is dropped
 * from the request and the stored row is written with skipConsent = false; the consent page
 * hardcodes verified=false).
 */

export const REGISTRATION_MAX_BODY_BYTES = 8 * 1024;
export const REGISTRATION_MAX_REDIRECT_URIS = 5;
export const REGISTRATION_MAX_URL_LENGTH = 2048;
export const REGISTRATION_MAX_NAME_LENGTH = 100;
/** Registrations per client address per hour (counted in the database, all instances). */
export const REGISTRATION_PER_IP_PER_HOUR = 10;
/** Registrations per hour over the whole server, counted in the database (all instances). */
export const REGISTRATION_GLOBAL_PER_HOUR = 100;
/** Registered clients that nobody ever consented to are deleted after this many days. */
export const REGISTRATION_UNUSED_TTL_DAYS = 7;

const DEFAULT_SCOPE = 'spaces:read';
const GRANT_TYPES = ['authorization_code', 'refresh_token'];
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
/** Marks rows created here, so rate counting and cleanup never touch CIMD or hand-made clients. */
export const REGISTRATION_MARKER = { registration: 'dcr' } as const;

type Json = Record<string, unknown>;

export type RegistrationVerdict =
  | { ok: true; request: Request; scopes: string[] }
  | { ok: false; response: Response };

function problem(
  status: number,
  error: string,
  description: string,
  headers: Record<string, string> = {},
) {
  return {
    ok: false as const,
    response: new Response(
      JSON.stringify({ error, error_description: description }),
      {
        status,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          ...headers,
        },
      },
    ),
  };
}
const invalid = (description: string) =>
  problem(400, 'invalid_client_metadata', description);

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/** Redirect URI rule: https, or http on loopback; no fragment, no credentials, bounded length. */
export function isAcceptableRedirectUri(value: unknown): value is string {
  if (!isString(value) || value.length > REGISTRATION_MAX_URL_LENGTH)
    return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || value.includes('#') || url.username || url.password)
    return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/** Display text: control characters and angle brackets removed, whitespace collapsed, capped. */
export function sanitizeText(value: unknown, max: number): string | undefined {
  if (!isString(value)) return undefined;
  const clean = value
    // eslint-disable-next-line no-control-regex, no-irregular-whitespace
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return clean || undefined;
}

/** Informational links: kept only when they are plain https URLs without credentials. */
export function sanitizeHttpsUrl(value: unknown): string | undefined {
  if (!isString(value) || value.length > REGISTRATION_MAX_URL_LENGTH)
    return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Validates and rewrites the registration body. Returns the clean body or an error response. */
export function cleanRegistrationBody(
  raw: unknown,
):
  | { ok: true; body: Json; scopes: string[] }
  | { ok: false; response: Response } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return invalid('body must be a JSON object');
  const input = raw as Json;

  const method = input.token_endpoint_auth_method ?? 'none';
  if (method !== 'none')
    return invalid('only public clients are accepted (auth method "none")');

  const grants = input.grant_types ?? GRANT_TYPES;
  if (
    !Array.isArray(grants) ||
    grants.length === 0 ||
    !grants.every((g) => isString(g) && GRANT_TYPES.includes(g)) ||
    !grants.includes('authorization_code')
  )
    return invalid(
      'grant_types must be authorization_code and optionally refresh_token',
    );

  const responses = input.response_types ?? ['code'];
  if (
    !Array.isArray(responses) ||
    responses.length !== 1 ||
    responses[0] !== 'code'
  )
    return invalid('response_types must be ["code"]');

  const uris = input.redirect_uris;
  if (
    !Array.isArray(uris) ||
    uris.length < 1 ||
    uris.length > REGISTRATION_MAX_REDIRECT_URIS ||
    !uris.every(isAcceptableRedirectUri)
  )
    return problem(
      400,
      'invalid_redirect_uri',
      'redirect_uris must be 1-5 https URLs, or http URLs on localhost, 127.0.0.1 or [::1], without fragments',
    );

  let requested: string[] = [DEFAULT_SCOPE];
  if (input.scope !== undefined) {
    if (!isString(input.scope) || input.scope.length > 200)
      return problem(400, 'invalid_scope', 'scope is malformed');
    requested = input.scope.split(/\s+/).filter(Boolean);
    const vocabulary = new Set<string>(AUTH_SERVER_SCOPES);
    if (requested.length === 0 || !requested.every((s) => vocabulary.has(s)))
      return problem(
        400,
        'invalid_scope',
        'scope must only contain scopes this server issues',
      );
  }
  // The authorize hook always adds offline_access, so a registered client must be able to carry it.
  const scopes = [...new Set([...requested, 'offline_access'])];

  const body: Json = {
    redirect_uris: uris,
    token_endpoint_auth_method: 'none',
    grant_types: grants,
    response_types: ['code'],
    scope: scopes.join(' '),
    client_name: sanitizeText(input.client_name, REGISTRATION_MAX_NAME_LENGTH),
    client_uri: sanitizeHttpsUrl(input.client_uri),
    logo_uri: sanitizeHttpsUrl(input.logo_uri),
    tos_uri: sanitizeHttpsUrl(input.tos_uri),
    policy_uri: sanitizeHttpsUrl(input.policy_uri),
    software_id: sanitizeText(input.software_id, 100),
    software_version: sanitizeText(input.software_version, 100),
    // Resource linking, keys, logout hooks, subject type, DPoP, contacts, software statements and
    // every unknown field are dropped on purpose.
  };
  for (const key of Object.keys(body))
    if (body[key] === undefined) delete body[key];
  return { ok: true, body, scopes };
}

/**
 * The address of the caller, for the per-address budget. Only the platform header is trusted, and
 * only on Vercel, where the platform sets it and overwrites anything the caller sent. Anywhere
 * else the caller controls every forwarding header, so all requests count as one address.
 */
export function clientAddress(request: Request): string {
  if (!process.env.VERCEL) return 'unknown';
  return request.headers.get('x-vercel-forwarded-for')?.trim() || 'unknown';
}

/** Serialises every reservation across all instances (arbitrary constant, only used here). */
const REGISTRATION_LOCK_KEY = 2608001;

/**
 * Takes one slot of an hourly budget, atomically across instances: under a transaction-scoped
 * advisory lock it drops expired slots, counts the bucket and inserts a slot only while under the
 * limit. Two concurrent requests can never both take the last slot. A slot stays taken even if
 * the registration later fails, so failed attempts count too. Returns false when over budget.
 */
export async function reserveRegistrationSlot(
  pool: AuthDbPool,
  bucket: string,
  limit: number,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock($1)', [
      REGISTRATION_LOCK_KEY,
    ]);
    // A new statement sees everything committed while it waited for the lock. Expired slots
    // do not count (they are deleted in purgeUnusedRegisteredClients).
    const { rowCount } = await client.query(
      `insert into as_registration_slot (bucket)
       select $1::text where (select count(*) from as_registration_slot
                         where bucket = $1::text and "createdAt" > now() - interval '1 hour') < $2::int`,
      [bucket, limit],
    );
    const allowed = (rowCount ?? 0) > 0;
    await client.query('commit');
    return allowed;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** The address is stored only as a hash, and only for an hour. */
export const addressBucket = (address: string) =>
  `ip:${createHash('sha256').update(address).digest('hex')}`;
export const GLOBAL_BUCKET = 'global';

/** For tests: forget every reservation. */
export async function resetRegistrationLimiter(pool: AuthDbPool) {
  await pool.query('delete from as_registration_slot');
}

async function readCappedBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > REGISTRATION_MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > REGISTRATION_MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Gate for POST /oauth2/register. Returns the request to hand to Better Auth (anonymous: cookies
 * and authorization are removed, so a signed-in browser is never treated as an owner and the
 * deny-all clientPrivileges hook is never consulted) or the response to send back.
 */
export async function guardRegistration(
  request: Request,
  pool: AuthDbPool,
): Promise<RegistrationVerdict> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json'))
    return problem(
      415,
      'invalid_request',
      'content-type must be application/json',
    );

  const tooMany = () =>
    problem(
      429,
      'temporarily_unavailable',
      'too many registrations, try again later',
      { 'retry-after': '3600' },
    );
  if (
    !(await reserveRegistrationSlot(
      pool,
      addressBucket(clientAddress(request)),
      REGISTRATION_PER_IP_PER_HOUR,
    ))
  ) {
    redactingLog('warn', 'registration refused: per-address limit');
    return tooMany();
  }

  const text = await readCappedBody(request);
  if (text === null) return problem(413, 'invalid_request', 'body too large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalid('body is not valid JSON');
  }
  const cleaned = cleanRegistrationBody(parsed);
  if (!cleaned.ok) return cleaned;

  // Reserved only for a request that passed validation, so malformed calls cannot use up the
  // server-wide budget for everyone else (they still count against their own address).
  if (
    !(await reserveRegistrationSlot(
      pool,
      GLOBAL_BUCKET,
      REGISTRATION_GLOBAL_PER_HOUR,
    ))
  ) {
    redactingLog('warn', 'registration refused: global limit');
    return tooMany();
  }
  await purgeUnusedRegisteredClients(pool).catch(() => undefined);

  const headers = new Headers(request.headers);
  for (const name of ['cookie', 'authorization', 'content-length'])
    headers.delete(name);
  headers.set('content-type', 'application/json');
  return {
    ok: true,
    scopes: cleaned.scopes,
    request: new Request(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(cleaned.body),
    }),
  };
}

/**
 * The library stores every registered client with the full registration vocabulary, whatever
 * the request asked for. Narrow the stored row to what the profile granted and mark it.
 */
export async function narrowRegisteredClient(
  pool: AuthDbPool,
  clientId: string,
  scopes: string[],
) {
  await pool.query(
    `update as_oauth_client set scopes = $2::jsonb, metadata = $3::jsonb, "skipConsent" = false
      where "clientId" = $1`,
    [clientId, JSON.stringify(scopes), JSON.stringify(REGISTRATION_MARKER)],
  );
}

/** Deletes registered clients nobody consented to within the TTL. Tokens cascade; there are none. */
export async function purgeUnusedRegisteredClients(pool: AuthDbPool) {
  await pool.query(
    `delete from as_registration_slot where "createdAt" < now() - interval '1 hour'`,
  );
  await pool.query(
    `delete from as_oauth_client c
      where c.metadata->>'registration' = 'dcr'
        and c."createdAt" < now() - make_interval(days => $1)
        and not exists (select 1 from as_oauth_consent x where x."clientId" = c."clientId")
        and not exists (select 1 from as_oauth_access_token t where t."clientId" = c."clientId")
        and not exists (select 1 from as_oauth_refresh_token r where r."clientId" = c."clientId")`,
    [REGISTRATION_UNUSED_TTL_DAYS],
  );
}
