import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
  type SpaceQuestWriteError,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

const WRITE_ERRORS: Record<
  SpaceQuestWriteError,
  { status: number; message: string }
> = {
  not_found: { status: 404, message: 'Quest not found.' },
  forbidden: {
    status: 403,
    message: 'Only Quest members can edit this Quest.',
  },
  lead_only: {
    status: 403,
    message: 'Only the Quest Lead can perform this action.',
  },
  archived: {
    status: 409,
    message: 'Archived Quests are read-only.',
  },
  delete_blocked_ratified: {
    status: 409,
    message:
      'Cannot delete a Quest that has ratified agreements depending on it.',
  },
  invalid_input: {
    status: 400,
    message: 'Invalid Quest data.',
  },
};

export function questWriteErrorResponse(error: SpaceQuestWriteError) {
  const { status, message } = WRITE_ERRORS[error];
  return NextResponse.json({ error: message, code: error }, { status });
}

export function bearerFromRequest(request: NextRequest): string {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function authorizeQuestRead(
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

export async function authorizeQuestWrite(
  request: NextRequest,
  spaceSlug: string,
) {
  const token = bearerFromRequest(request);
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

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Authentication is required.' },
        { status: 401 },
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

  const personName = [auth.person.name, auth.person.surname]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    ok: true as const,
    space,
    person: auth.person,
    actor: {
      id: auth.person.id,
      name: personName || auth.person.nickname || 'Space Member',
      avatarUrl: auth.person.avatarUrl ?? null,
    },
    token,
  };
}
