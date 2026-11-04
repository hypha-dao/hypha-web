import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import type { AuthServer } from './auth';
import { describeScope } from './scope-copy';

export type ConsentRequest = {
  oauthQuery: string;
  person: { id: string; name: string };
  client: {
    clientId: string;
    name: string;
    /** Host the app identifies itself from (its metadata document or client URI). */
    host: string;
    /** Host the person is sent back to after approving. */
    redirectHost: string;
    /** Every app that connects without being registered with Hypha is unverified. */
    verified: false;
  };
  scopes: { scope: string; title: string; detail: string }[];
};

/**
 * Everything the consent page shows, read on the server from verified data only: the signed
 * authorization query, the signed-in person and the stored client record. Returns null when
 * the query is unsigned, expired, or no one is signed in.
 */
export async function loadConsentRequest(
  server: AuthServer,
  headers: Headers,
  rawQuery: string,
): Promise<ConsentRequest | null> {
  const { auth, pool, config } = server;
  const oauthQuery = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  if (!(await verifyOAuthQueryParams(oauthQuery, config.secret))) return null;
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const params = new URLSearchParams(oauthQuery);
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  if (!clientId || !redirectUri) return null;

  const { rows } = await pool.query(
    'select name, uri from as_oauth_client where "clientId" = $1 limit 1',
    [clientId],
  );
  const row = rows[0];
  if (!row) return null;

  const hostOf = (value: string | null | undefined) => {
    try {
      return value ? new URL(value).host : '';
    } catch {
      return '';
    }
  };
  const requested = (params.get('scope') ?? '').split(/\s+/).filter(Boolean);
  return {
    oauthQuery,
    person: { id: session.user.id, name: session.user.name },
    client: {
      clientId,
      name: row.name || hostOf(clientId) || 'Unnamed app',
      host: hostOf(row.uri) || hostOf(clientId),
      redirectHost: hostOf(redirectUri),
      verified: false,
    },
    scopes: requested.map((scope) => ({ scope, ...describeScope(scope) })),
  };
}
