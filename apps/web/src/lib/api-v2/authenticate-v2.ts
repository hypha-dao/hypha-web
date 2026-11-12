import 'server-only';
import {
  authenticateIntegrationClient,
  findPersonBySub,
  resolveV2Caller,
  V2_RESPONSE_HEADERS,
  withV2Headers,
  type V2Caller,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthServerConfig } from '../../app/(auth)/auth/_lib/server';
import {
  resolveAuthServerToken,
  tokenMatchesRegistryClient,
} from './as-caller';

export type V2AuthResult =
  | { ok: true; caller: V2Caller }
  | { ok: false; response: NextResponse };

/**
 * Auth shared by every `/api/v2` read (K13): the client key is always
 * required (`x-hypha-client-key`, any approved client, no scope); the user
 * token (`Authorization: Bearer`) is optional and verified with
 * `verifyPrivyAuthToken`. Routes decide what a guest may see.
 */
export async function authenticateV2(
  request: NextRequest,
): Promise<V2AuthResult> {
  const clientAuth = await authenticateIntegrationClient({ request }, { db });
  if (!clientAuth.ok) {
    return {
      ok: false,
      response: jsonV2(
        { error: clientAuth.error, code: clientAuth.code },
        { status: clientAuth.status },
      ),
    };
  }

  // #2608 spike: a token from our own authorization server identifies the person.
  const asToken = await resolveAuthServerToken(request, getAuthServerConfig());
  if (asToken.kind === 'failure') {
    return {
      ok: false,
      response: jsonV2({ error: asToken.error }, { status: asToken.status }),
    };
  }
  if (asToken.kind === 'ok') {
    if (!tokenMatchesRegistryClient(asToken.clientId, clientAuth.client.slug)) {
      console.warn(
        `v2: AS token client_id does not match the client key's registry slug (token client: ${asToken.clientId}, key client: ${clientAuth.client.slug})`,
      );
      return {
        ok: false,
        response: jsonV2({ error: 'client_mismatch' }, { status: 403 }),
      };
    }
    const person = await findPersonBySub({ sub: asToken.sub }, { db });
    if (!person) {
      return {
        ok: false,
        response: jsonV2(
          { error: 'A Hypha profile is required' },
          { status: 403 },
        ),
      };
    }
    return {
      ok: true,
      caller: {
        kind: 'user',
        person,
        address: (person.address as `0x${string}` | null | undefined) ?? null,
      },
    };
  }

  const caller = await resolveV2Caller(request.headers.get('authorization'), {
    db,
  });
  if (!caller.ok) {
    return {
      ok: false,
      response: jsonV2(
        {
          error: caller.error,
          ...(caller.message && { message: caller.message }),
        },
        { status: caller.status },
      ),
    };
  }
  return { ok: true, caller: caller.caller };
}

export function jsonV2(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status,
    headers: V2_RESPONSE_HEADERS,
  });
}

/**
 * Every v2 route exports its handler through this wrapper: all responses,
 * including an error that escaped the handler, carry the v2 cache headers.
 */
export function v2Route<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return withV2Headers(handler, (error) => {
    console.error('Unhandled v2 route error:', error);
    return jsonV2({ error: 'Internal error' }, { status: 500 });
  });
}

export function failureResponse(failure: {
  status: number;
  error: string;
  message?: string;
}): NextResponse {
  return jsonV2(
    {
      error: failure.error,
      ...(failure.message && { message: failure.message }),
    },
    { status: failure.status },
  );
}
