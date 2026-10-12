import 'server-only';
import {
  findPersonBySub,
  verifyPrivyAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

type Person = NonNullable<Awaited<ReturnType<typeof findPersonBySub>>>;

export type HyphaUserAuthResult =
  | { ok: true; person: Person }
  | { ok: false; response: NextResponse };

/**
 * Resolve the logged-in Hypha person from a Privy access token sent as
 * `Authorization: Bearer`. 401 without a valid token, 403 when the account has
 * no Hypha profile.
 */
export async function authenticateHyphaUser(
  request: NextRequest,
): Promise<HyphaUserAuthResult> {
  const unauthorized = {
    ok: false as const,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };

  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!token) return unauthorized;

  const auth = await verifyPrivyAuthToken(token);
  if (!auth.ok) return unauthorized;

  const person = await findPersonBySub({ sub: auth.userId }, { db });
  if (!person) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'A Hypha profile is required' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, person };
}
