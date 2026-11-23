import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import type { AuthServer } from './auth';
import { AUTH_SERVER_WRITE_SCOPES } from './config';
import { describeScope, type ScopeCopyKey } from './scope-copy';
import { describeRedirect } from './redirect-display';

/**
 * How the app was identified, which decides the defaults on the consent page. The kind comes
 * from how the stored row was created, never from the shape of the client id:
 * - `registered`: pre-registered with Hypha (tier A), marked `metadata.registration = 'registered'`
 *   when the row is created; keeps the product defaults;
 * - `cimd`: the library created the row from the app's own metadata document (discovery id set);
 * - `dcr`: registered itself through dynamic registration, or a row that cannot be told apart
 *   (no marker, no discovery id): the least trusted kind. Its name is a claim, not checked.
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
    /**
     * Where the person is sent back to after approving: the host for a website or a local
     * address, the scheme and host (or path) for an app on their computer (never empty for a URL).
     */
    redirectHost: string;
    /** Every app that connects without being registered with Hypha is unverified. */
    verified: false;
    kind: ClientKind;
  };
  scopes: {
    scope: string;
    /** Entry of the page's messages (AuthServer.scopes.<copyKey>) that words this scope. */
    copyKey: ScopeCopyKey;
    /** Ticked when the page opens. Write scopes start unticked for clients that are not pre-approved. */
    defaultGranted: boolean;
    /** Show the stronger warning of that entry: a write scope of a client that is not pre-approved. */
    warn: boolean;
  }[];
};

/**
 * Tells an expired signed query from a bad one, so the page can say "start again" instead of a
 * generic error. Only the clock is read here; the signature check is the library's.
 */
export async function inspectConsentQuery(
  rawQuery: string,
  secret: string,
): Promise<'valid' | 'expired' | 'invalid'> {
  const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  if (await verifyOAuthQueryParams(query, secret)) return 'valid';
  const params = new URLSearchParams(query);
  const exp = Number(params.get('exp'));
  return params.get('sig') && Number.isFinite(exp) && exp * 1000 < Date.now()
    ? 'expired'
    : 'invalid';
}

/** Marker stored on rows Hypha pre-registered by hand. Without it a row is never `registered`. */
export const REGISTERED_CLIENT_MARKER = 'registered';

/**
 * The page may carry `?lang=` next to the signed authorization query. The signature covers every
 * other parameter, so `lang` is a page setting only when taking it out leaves a valid signed
 * query. If the signed query itself contains a `lang` (the app sent one), it is left alone and
 * is not a page setting. With no valid query either way, the stripped one is returned (it is
 * the more likely to be what the app sent) and `lang` is still reported, for the cosmetic choice.
 */
export async function separatePageLang(
  rawQuery: string,
  secret: string,
): Promise<{ query: string; lang: string | null }> {
  const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  const params = new URLSearchParams(query);
  if (!params.has('lang')) return { query, lang: null };
  const lang = params.get('lang');
  const stripped = new URLSearchParams(query);
  stripped.delete('lang');
  const strippedQuery = stripped.toString();
  if (await verifyOAuthQueryParams(strippedQuery, secret))
    return { query: strippedQuery, lang };
  if (await verifyOAuthQueryParams(query, secret)) return { query, lang: null };
  return { query: strippedQuery, lang };
}

export function classifyClient(stored: {
  clientDiscoveryId?: unknown;
  registration?: unknown;
}): ClientKind {
  if (stored.registration === 'dcr') return 'dcr';
  if (typeof stored.clientDiscoveryId === 'string' && stored.clientDiscoveryId)
    return 'cimd';
  if (stored.registration === REGISTERED_CLIENT_MARKER) return 'registered';
  // Fail closed: unknown provenance gets the least trusted treatment.
  return 'dcr';
}

export type ConsentEntry = 'show' | 'sign-in' | 'expired' | 'restart';

/**
 * What the consent page does first. A valid signed query without a session goes to sign-in and
 * keeps the query; an expired or invalid one never goes to sign-in (it could not be used).
 */
export function decideConsentEntry(
  query: 'valid' | 'expired' | 'invalid',
  hasSession: boolean,
): ConsentEntry {
  if (query === 'expired') return 'expired';
  if (query === 'invalid') return 'restart';
  return hasSession ? 'show' : 'sign-in';
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
    `select name, uri, "clientDiscoveryId", metadata->>'registration' as registration
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
  const kind = classifyClient({
    clientDiscoveryId: row.clientDiscoveryId,
    registration: row.registration,
  });
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
      redirectHost: describeRedirect(redirectUri).display,
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
        copyKey: copy.key,
        defaultGranted: !(write && kind !== 'registered'),
        warn: write && kind !== 'registered' && copy.hasWarning,
      };
    }),
  };
}
