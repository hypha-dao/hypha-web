import {
  authorizeSpaceBankOnboarding,
  findSpaceBySlug,
  verifyPrivyAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() ?? null;
}

type SpaceRecord = NonNullable<Awaited<ReturnType<typeof findSpaceBySlug>>>;

type AuthenticateBankCustomerResult =
  | { ok: true; space: SpaceRecord }
  | { ok: false; response: NextResponse };

export async function authenticateBankCustomerRequest(
  request: NextRequest,
  spaceSlug: string,
): Promise<AuthenticateBankCustomerResult> {
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

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Space not found' }, { status: 404 }),
    };
  }

  const authorization = await authorizeSpaceBankOnboarding({
    space,
    authToken,
  });

  if (!authorization.authorized) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: authorization.message },
        { status: authorization.httpStatus },
      ),
    };
  }

  return { ok: true, space };
}
