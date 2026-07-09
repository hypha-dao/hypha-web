import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import {
  findPersonBySub,
  findSpaceBySlug,
  isOnChainMemberOrDelegate,
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

type AuthenticatePersonResult =
  | { ok: true; person: PersonRecord }
  | { ok: false; response: NextResponse };

type AuthenticateSubscriptionResult =
  | { ok: true; space: SpaceRecord; person: PersonRecord }
  | { ok: false; response: NextResponse };

/**
 * Verifies the Privy Bearer token and resolves the caller's person record.
 * Used by person-scoped subscription endpoints (`/api/v1/me/subscriptions`)
 * where no space membership check applies.
 */
export async function authenticatePersonRequest(
  request: NextRequest,
): Promise<AuthenticatePersonResult> {
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

  return { ok: true, person };
}

/**
 * Any space member may manage a Stripe subscription for that space:
 * verifies the Privy Bearer token, resolves the person, and checks
 * membership via a DB row first, falling back to the on-chain
 * member-or-delegate check (membership's source of truth is the
 * DAOSpaceFactory contract; DB rows may lag or be absent on previews).
 */
export async function authenticateSubscriptionRequest(
  request: NextRequest,
  spaceSlug: string,
): Promise<AuthenticateSubscriptionResult> {
  const personResult = await authenticatePersonRequest(request);
  if (!personResult.ok) {
    return personResult;
  }
  const { person } = personResult;

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

  if (membership) {
    return { ok: true, space, person };
  }

  if (typeof space.web3SpaceId === 'number' && person.address) {
    try {
      const allowed = await isOnChainMemberOrDelegate(
        space.web3SpaceId,
        person.address as `0x${string}`,
      );
      if (allowed) {
        return { ok: true, space, person };
      }
    } catch (error) {
      console.error(
        'subscription auth: on-chain membership check failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Only space members can manage the subscription' },
      { status: 403 },
    ),
  };
}
