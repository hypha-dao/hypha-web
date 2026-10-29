import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

export function bearerFromRequest(request: NextRequest): string {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function authorizeContextRead(
  request: NextRequest,
  spaceSlug: string,
) {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Space not found' },
        { status: 404 },
      ),
    };
  }

  if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) {
      return { ok: false as const, response };
    }
  }

  return { ok: true as const, space };
}

export async function authorizeContextWrite(
  request: NextRequest,
  spaceSlug: string,
) {
  const token = bearerFromRequest(request);
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Authentication is required.' },
        { status: 401 },
      ),
    };
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Space not found' },
        { status: 404 },
      ),
    };
  }

  const auth = await authorizeSpacePanelInteraction({
    spaceSlug,
    authToken: token,
  });
  if (!auth.authorized) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: auth.message }, { status: 403 }),
    };
  }

  return { ok: true as const, space, person: auth.person, token };
}
