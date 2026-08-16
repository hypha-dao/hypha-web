import type { DbConfig } from '../../server';
import { hashSpaceApiKey, safeEqualHashes } from '../generate-api-key';
import type { SpaceApiKeyScope } from '../types';
import { spaceApiKeySatisfiesScope } from '../types';
import { findActiveSpaceApiKeyByHash } from './queries';
import { touchSpaceApiKeyLastUsed } from './mutations';

export const SPACE_API_KEY_HEADER = 'x-hypha-api-key';

export type AuthenticatedSpaceApiKey = {
  id: number;
  spaceId: number;
  name: string;
  source: string;
  scopes: SpaceApiKeyScope[];
};

export type SpaceApiKeyAuthResult =
  | { ok: true; apiKey: AuthenticatedSpaceApiKey }
  | { ok: false; status: 401 | 403; error: string };

export function readSpaceApiKeyFromRequest(
  request: Request,
): string | undefined {
  const explicit = request.headers.get(SPACE_API_KEY_HEADER)?.trim();
  if (explicit) return explicit;

  const bearer = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  return bearer || undefined;
}

function recordSpaceApiKeyUsage(
  apiKey: AuthenticatedSpaceApiKey,
  { db }: DbConfig,
): void {
  // Telemetry, not an auth input: never make a valid key fail, or pay for a
  // serialized write, because of it.
  void touchSpaceApiKeyLastUsed({ id: apiKey.id }, { db }).catch((error) => {
    console.warn('Failed to record API key usage', {
      keyId: apiKey.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Resolve a presented key to an active row without checking space or scope.
 * Callers that bind the key to a path (REST) or infer the space (hosted MCP)
 * apply those checks themselves before treating the request as authorized.
 */
async function lookupPresentedSpaceApiKey(
  request: Request,
  { db }: DbConfig,
): Promise<SpaceApiKeyAuthResult> {
  const presented = readSpaceApiKeyFromRequest(request);
  if (!presented) {
    return {
      ok: false,
      status: 401,
      error: `Missing API key. Send it in the ${SPACE_API_KEY_HEADER} header.`,
    };
  }

  const presentedHash = hashSpaceApiKey(presented);
  const row = await findActiveSpaceApiKeyByHash(
    { keyHash: presentedHash },
    { db },
  );
  if (!row || !safeEqualHashes(row.keyHash, presentedHash)) {
    return { ok: false, status: 401, error: 'Invalid or revoked API key.' };
  }

  return {
    ok: true,
    apiKey: {
      id: row.id,
      spaceId: row.spaceId,
      name: row.name,
      source: row.source,
      scopes: (row.scopes ?? []) as SpaceApiKeyScope[],
    },
  };
}

/**
 * Verify an inbound integration key without a space path. Hosted MCP uses this
 * then loads the key's space and checks intelligence scopes.
 */
export async function authenticateSpaceApiKeyUnscoped(
  request: Request,
  { db }: DbConfig,
): Promise<SpaceApiKeyAuthResult> {
  const result = await lookupPresentedSpaceApiKey(request, { db });
  if (result.ok) {
    recordSpaceApiKeyUsage(result.apiKey, { db });
  }
  return result;
}

/**
 * Verify an inbound integration key against a single space and scope.
 *
 * The lookup is by SHA-256 digest, so no secret is ever used in a SQL
 * comparison; the digests are then re-compared with a timing-safe check.
 * A key issued for another space is rejected even though digests are globally
 * unique, so a key can never be replayed against a space it does not own.
 */
export async function authenticateSpaceApiKey(
  {
    request,
    spaceId,
    requiredScope,
  }: {
    request: Request;
    spaceId: number;
    requiredScope: SpaceApiKeyScope;
  },
  { db }: DbConfig,
): Promise<SpaceApiKeyAuthResult> {
  const result = await lookupPresentedSpaceApiKey(request, { db });
  if (!result.ok) return result;

  if (result.apiKey.spaceId !== spaceId) {
    return {
      ok: false,
      status: 403,
      error: 'This API key is not valid for this space.',
    };
  }

  if (!spaceApiKeySatisfiesScope(result.apiKey.scopes, requiredScope)) {
    return {
      ok: false,
      status: 403,
      error: `This API key is missing the "${requiredScope}" scope.`,
    };
  }

  recordSpaceApiKeyUsage(result.apiKey, { db });
  return result;
}
