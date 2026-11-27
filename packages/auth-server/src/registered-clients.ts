import type { AuthDbPool } from './db';
import { REGISTERED_CLIENT_MARKER } from './consent';

/**
 * Apps pre-registered with Hypha (tier A): public clients (PKCE, no secret) with a fixed, public,
 * non-secret client id. The row is marked `metadata.registration = 'registered'`; that marker is
 * what makes the consent page treat the app as `registered` (see `classifyClient`). This list is
 * the single place to read what is registered; nothing here is created at runtime. A person
 * (the human, with the database owner) applies it with `seedRegisteredClients`, or with the same
 * statement in SQL (see README), and no code path calls it on its own.
 *
 * Dynamic registration is separate and unchanged: it accepts only https or loopback redirects and
 * stays off. The custom-scheme redirects below exist only on rows listed here.
 */
export type RegisteredClient = {
  /** Stable and documented: the app's own configuration carries it, so it is never rotated. */
  clientId: string;
  name: string;
  /** Exact redirect URIs. Add a line here when an app is known to send another one. */
  redirectUris: readonly string[];
  scopes: readonly string[];
};

/** Cursor: its MCP configuration carries this id as the static `CLIENT_ID` of its `auth` block. */
export const CURSOR_CLIENT_ID = 'hypha-cursor';

export const REGISTERED_CLIENTS: readonly RegisteredClient[] = [
  {
    clientId: CURSOR_CLIENT_ID,
    name: 'Cursor',
    redirectUris: [
      // Documented fixed redirect of Cursor's MCP OAuth. Newer Cursor versions may send a localhost
      // one instead (a forum report, unverified): add it here after the first connection shows it.
      'cursor://anysphere.cursor-mcp/oauth/callback',
    ],
    // `signals:write` is granted only while the authorization server accepts it on the MCP
    // resource (`MCP_WRITES_ENABLED`) and the person allows it on the consent page (#2744).
    scopes: ['spaces:read', 'signals:write', 'offline_access'],
  },
];

/** Schemes that run code or open local data when navigated to; never a valid app redirect. */
const SCRIPTABLE_SCHEMES = new Set([
  'javascript:',
  'vbscript:',
  'data:',
  'blob:',
  'file:',
  'about:',
]);

/** Redirects a registered client may carry: https, loopback http, or a custom app scheme. */
export function isAcceptableRegisteredRedirect(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (SCRIPTABLE_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === 'http:')
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return true;
}

/** The idempotent upsert for one registered client (one statement, safe to run twice). */
export function registeredClientUpsert(client: RegisteredClient): {
  text: string;
  values: unknown[];
} {
  return {
    text: `insert into as_oauth_client (id, "clientId", name, "redirectUris", scopes, "tokenEndpointAuthMethod",
       "grantTypes", "responseTypes", "requirePKCE", "skipConsent", "createdAt", "updatedAt", metadata)
     values ($1, $1, $2, $3::jsonb, $4::jsonb, 'none',
       '["authorization_code","refresh_token"]'::jsonb, '["code"]'::jsonb, true, false, now(), now(), $5::jsonb)
     on conflict ("clientId") do update set
       name = excluded.name,
       "redirectUris" = excluded."redirectUris",
       scopes = excluded.scopes,
       "tokenEndpointAuthMethod" = 'none',
       "clientSecret" = null,
       "requirePKCE" = true,
       "skipConsent" = false,
       disabled = false,
       metadata = excluded.metadata,
       "updatedAt" = now()`,
    values: [
      client.clientId,
      client.name,
      JSON.stringify(client.redirectUris),
      JSON.stringify(client.scopes),
      JSON.stringify({ registration: REGISTERED_CLIENT_MARKER }),
    ],
  };
}

/** Writes every listed client. Run by a person against a database they chose; never at startup. */
export async function seedRegisteredClients({
  db,
  clients = REGISTERED_CLIENTS,
}: {
  db: Pick<AuthDbPool, 'query'>;
  clients?: readonly RegisteredClient[];
}): Promise<void> {
  for (const client of clients) {
    const { text, values } = registeredClientUpsert(client);
    await db.query(text, values);
  }
}
