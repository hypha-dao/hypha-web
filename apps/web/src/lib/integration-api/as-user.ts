import 'server-only';
import {
  authenticateIntegrationUser,
  findPersonBySub,
  type UserAuthContext,
  type UserAuthResult,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { getAuthServerConfig } from '../../app/(auth)/auth/_lib/server';
import {
  resolveAuthServerToken,
  tokenMatchesRegistryClient,
} from '../api-v2/as-caller';

/**
 * #2608 TEMP (API work, not for the AS extraction): the person behind an authorization-server
 * token, for the app-facing integration routes (`POST actions`, `GET actions/{id}`). Same rules
 * as v2: issuer routing, signature, audience, allowlist re-check and scope are verified by
 * `resolveAuthServerToken`; the token's `client_id` must equal the slug of the client key's
 * registry client (403 `client_mismatch`).
 *
 * Returns `null` for a token that is not ours, so the caller can fall back to Privy. A token
 * that claims to be ours is never handed to Privy.
 */
export async function authenticateIntegrationUserWithAs(
  request: Request,
  context: UserAuthContext | undefined,
  {
    config = getAuthServerConfig(),
    keys,
  }: {
    config?: ReturnType<typeof getAuthServerConfig>;
    keys?: Parameters<typeof resolveAuthServerToken>[2];
  } = {},
): Promise<UserAuthResult | null> {
  const asToken = await resolveAuthServerToken(
    request,
    config,
    keys,
    context?.scope,
  );
  if (asToken.kind === 'not-as-token') return null;
  if (asToken.kind === 'failure') {
    if (asToken.error === 'insufficient_scope') {
      return {
        ok: false,
        status: 403,
        code: 'insufficient_scope',
        error: 'insufficient_scope',
      };
    }
    return asToken.status === 403
      ? { ok: false, status: 403, code: 'invalid_token', error: asToken.error }
      : {
          ok: false,
          status: 401,
          code: 'invalid_token',
          error: 'Unauthorized',
        };
  }
  if (
    !context?.client ||
    !tokenMatchesRegistryClient(asToken.clientId, context.client.slug)
  ) {
    console.warn(
      `integration: AS token client_id does not match the client key's registry slug (token client: ${
        asToken.clientId
      }, key client: ${context?.client?.slug ?? 'none'})`,
    );
    return {
      ok: false,
      status: 403,
      code: 'client_mismatch',
      error: 'client_mismatch',
    };
  }
  const person = await findPersonBySub({ sub: asToken.sub }, { db });
  if (!person) {
    return {
      ok: false,
      status: 403,
      code: 'profile_required',
      error: 'A Hypha profile is required',
    };
  }
  return {
    ok: true,
    user: {
      id: person.id,
      email: person.email,
      name: person.name,
      surname: person.surname,
      slug: person.slug,
    },
  };
}

/** AS token when it is one of ours, otherwise the existing Privy check (unchanged). */
export async function authenticateIntegrationUserAsOrPrivy(
  request: Request,
  context?: UserAuthContext,
): Promise<UserAuthResult> {
  return (
    (await authenticateIntegrationUserWithAs(request, context)) ??
    authenticateIntegrationUser(request, { db })
  );
}
