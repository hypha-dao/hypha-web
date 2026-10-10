import type { DbConfig } from '../../server';
import {
  hashClientKey,
  safeEqualClientKeyHashes,
} from '../generate-client-key';
import type { IntegrationClientScope } from '../types';
import { findIntegrationClientByKeyHash } from './queries';

export const INTEGRATION_CLIENT_KEY_HEADER = 'x-hypha-client-key';

export type AuthenticatedIntegrationClient = {
  id: number;
  slug: string;
  name: string;
  scopes: IntegrationClientScope[];
};

/** Machine-readable reasons, so integrators can tell the failures apart. */
export type ClientAuthErrorCode =
  | 'missing_key'
  | 'invalid_key'
  | 'client_not_approved'
  | 'missing_scope';

export type ClientAuthResult =
  | { ok: true; client: AuthenticatedIntegrationClient }
  | { ok: false; status: 401 | 403; code: ClientAuthErrorCode; error: string };

/**
 * Only the dedicated header is read. `Authorization: Bearer` carries the
 * user's Privy token on these routes, so it must never be taken as a key.
 */
export function readClientKeyFromRequest(request: Request): string | undefined {
  return (
    request.headers.get(INTEGRATION_CLIENT_KEY_HEADER)?.trim() || undefined
  );
}

/**
 * Verify an inbound client key and the scope the operation requires. Lookup is
 * by SHA-256 digest (no secret in a SQL comparison), then re-compared in
 * constant time.
 */
export async function authenticateIntegrationClient(
  {
    request,
    requiredScope,
  }: { request: Request; requiredScope: IntegrationClientScope },
  { db }: DbConfig,
): Promise<ClientAuthResult> {
  const presented = readClientKeyFromRequest(request);
  if (!presented) {
    return {
      ok: false,
      status: 401,
      code: 'missing_key',
      error: `Missing client key. Send it in the ${INTEGRATION_CLIENT_KEY_HEADER} header.`,
    };
  }

  const presentedHash = hashClientKey(presented);
  const row = await findIntegrationClientByKeyHash(
    { keyHash: presentedHash },
    { db },
  );
  if (
    !row ||
    !row.keyHash ||
    !safeEqualClientKeyHashes(row.keyHash, presentedHash)
  ) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_key',
      error: 'Invalid client key.',
    };
  }

  if (row.status !== 'approved') {
    return {
      ok: false,
      status: 403,
      code: 'client_not_approved',
      error: 'This client is not approved.',
    };
  }

  const scopes = (row.scopes ?? []) as IntegrationClientScope[];
  if (!scopes.includes(requiredScope)) {
    return {
      ok: false,
      status: 403,
      code: 'missing_scope',
      error: `This client is missing the "${requiredScope}" scope.`,
    };
  }

  return {
    ok: true,
    client: { id: row.id, slug: row.slug, name: row.name, scopes },
  };
}
