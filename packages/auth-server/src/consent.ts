import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import type { AuthServer } from './auth';
import { AUTH_SERVER_WRITE_SCOPES } from './config';
import { describeScope } from './scope-copy';

/**
 * How the app was identified, which decides the defaults on the consent page:
 * - `registered`: pre-registered with Hypha (tier A); keeps the product defaults;
 * - `cimd`: no registration, identified by an https `client_id` that serves its own metadata;
 * - `dcr`: registered itself through dynamic registration; its name is a claim, not checked.
 * Only `registered` is pre-approved.
 */
export type ClientKind = 'registered' | 'cimd' | 'dcr';

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
    kind: ClientKind;
  };
  scopes: {
    scope: string;
    title: string;
    detail: string;
    /** Ticked when the page opens. Write scopes start unticked for clients that are not pre-approved. */
    defaultGranted: boolean;
    /** Stronger warning shown with the scope, for write scopes of clients that are not pre-approved. */
    warning?: string;
  }[];
};

export function classifyClient(
  clientId: string,
  registration: unknown,
): ClientKind {
  if (registration === 'dcr') return 'dcr';
  if (/^https:\/\//i.test(clientId)) return 'cimd';
  return 'registered';
}

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
    `select name, uri, metadata->>'registration' as registration
       from as_oauth_client where "clientId" = $1 limit 1`,
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
  const kind = classifyClient(clientId, row.registration);
  const requested = (params.get('scope') ?? '').split(/\s+/).filter(Boolean);
  return {
    oauthQuery,
    person: { id: session.user.id, name: session.user.name },
    client: {
      clientId,
      name: row.name || hostOf(clientId) || 'Unnamed app',
      // CIMD: the host of the https client id is the one thing that is proven. DCR: nothing about
      // the app is proven (its stored link is a claim), so no host is offered as identity.
      host:
        kind === 'cimd'
          ? hostOf(clientId)
          : kind === 'dcr'
          ? ''
          : hostOf(row.uri) || hostOf(clientId),
      redirectHost: hostOf(redirectUri),
      verified: false,
      kind,
    },
    scopes: requested.map((scope) => {
      const write = (AUTH_SERVER_WRITE_SCOPES as readonly string[]).includes(
        scope,
      );
      const copy = describeScope(scope);
      return {
        scope,
        ...copy,
        defaultGranted: !(write && kind !== 'registered'),
        warning:
          write && kind !== 'registered' ? copy.unverifiedWarning : undefined,
      };
    }),
  };
}
