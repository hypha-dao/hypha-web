import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
  type SpaceContextWriteError,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

const WRITE_ERRORS: Record<
  SpaceContextWriteError,
  { status: number; message: string }
> = {
  not_found: { status: 404, message: 'Section not found' },
  on_voting: {
    status: 409,
    message: 'The section is on voting. It can change after the vote.',
  },
  removed: { status: 409, message: 'The section was removed.' },
  invalid_title: { status: 400, message: 'A section needs a title.' },
  duplicate_title: {
    status: 409,
    message: 'A section with this title already exists.',
  },
  not_allowed: {
    status: 409,
    message: 'This change is not possible for the section now.',
  },
};

export function contextWriteErrorResponse(error: SpaceContextWriteError) {
  const { status, message } = WRITE_ERRORS[error];
  return NextResponse.json({ error: message, code: error }, { status });
}

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
