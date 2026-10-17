import 'server-only';
import {
  authenticateIntegrationClient,
  resolveV2Caller,
  V2_RESPONSE_HEADERS,
  withV2Headers,
  type V2Caller,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

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
