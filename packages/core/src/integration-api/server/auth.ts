import { createHash, timingSafeEqual } from 'node:crypto';

import { verifyPrivyAuthToken } from '../../common/server/verify-privy-auth-token';
import { findPersonBySub } from '../../people/server/queries';
import type { DbConfig } from '../../server';
import type { IntegrationUser, UserAuthResult } from '../handlers';
import { integrationJson } from '../response-headers';

const OPS_SECRET_HEADER = 'x-hypha-ops-secret';

/**
 * Resolve the signed-in Hypha person from a user token sent as
 * `Authorization: Bearer`. 401 without a valid token, 403 when the account has
 * no Hypha profile (registration and requests need one).
 */
export async function authenticateIntegrationUser(
  request: Request,
  { db }: DbConfig,
): Promise<UserAuthResult> {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };

  const auth = await verifyPrivyAuthToken(token);
  if (!auth.ok) return { ok: false, status: 401, error: 'Unauthorized' };

  const person = await findPersonBySub({ sub: auth.userId }, { db });
  if (!person) {
    return {
      ok: false,
      status: 403,
      error: 'A Hypha profile is required',
    };
  }
  const user: IntegrationUser = {
    id: person.id,
    email: person.email,
    name: person.name,
    surname: person.surname,
    slug: person.slug,
  };
  return { ok: true, user };
}

/**
 * Compare secrets through their digests so neither length nor content leaks
 * through timing. The digest only gives `timingSafeEqual` two equal-length
 * buffers; it is never persisted. What protects the secret is that the
 * operator generates a high-entropy value and keeps it to the ops team.
 */
function secretMatches(presented: string, expected: string): boolean {
  const digest = (value: string) =>
    createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

function readOpsSecret(request: Request): string {
  const explicit = request.headers.get(OPS_SECRET_HEADER)?.trim();
  if (explicit) return explicit;
  return (
    request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim() || ''
  );
}

/**
 * Guard for the `ops/` area: its own secret, separate from the space API key
 * one, so the two can be rotated and handed out independently. Returns the
 * response to send when the caller is not ops, or null to continue.
 */
export function authorizeIntegrationOps(
  request: Request,
  configuredSecret: string | undefined,
): Response | null {
  const expected = configuredSecret?.trim() ?? '';
  if (!expected) {
    return integrationJson(
      { error: 'HYPHA_INTEGRATION_CLIENT_OPS_SECRET is not configured' },
      { status: 503 },
    );
  }
  const presented = readOpsSecret(request);
  if (!presented || !secretMatches(presented, expected)) {
    return integrationJson({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
