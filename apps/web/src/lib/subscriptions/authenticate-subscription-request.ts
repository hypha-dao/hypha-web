import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import {
  findPersonBySub,
  findSpaceBySlug,
  verifyPrivyAuthToken,
} from '@hypha-platform/core/server';
import { db, memberships } from '@hypha-platform/storage-postgres';

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() ?? null;
}

type SpaceRecord = NonNullable<Awaited<ReturnType<typeof findSpaceBySlug>>>;
type PersonRecord = NonNullable<Awaited<ReturnType<typeof findPersonBySub>>>;

type AuthenticateSubscriptionResult =
  | { ok: true; space: SpaceRecord; person: PersonRecord }
  | { ok: false; response: NextResponse };

/**
 * Any space member may manage a Stripe subscription for that space:
 * verifies the Privy Bearer token, resolves the person, and checks a
 * DB membership row for the space.
 */
export async function authenticateSubscriptionRequest(
  request: NextRequest,
  spaceSlug: string,
): Promise<AuthenticateSubscriptionResult> {
  const authToken = extractBearerToken(request);
  if (!authToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const auth = await verifyPrivyAuthToken(authToken);
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const person = await findPersonBySub({ sub: auth.userId }, { db });
  if (!person) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Person not found' },
        { status: 404 },
      ),
    };
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Space not found' },
        { status: 404 },
      ),
    };
  }

  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.spaceId, space.id),
        eq(memberships.personId, person.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Only space members can manage the subscription' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, space, person };
}
