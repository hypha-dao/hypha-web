import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
  resolvePersonFromAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

export async function resolvePipelineSpace(spaceSlug: string) {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      space: null,
      error: NextResponse.json({ error: 'Space not found' }, { status: 404 }),
    };
  }
  if (!space.pipelineEnabled) {
    return {
      space: null,
      error: NextResponse.json(
        { error: 'Deal Pipeline is not enabled for this space' },
        { status: 404 },
      ),
    };
  }
  return { space, error: null };
}

export async function assertPipelineWriteAccess(
  spaceSlug: string,
  request: NextRequest,
) {
  const authToken = parseBearerToken(request.headers.get('Authorization'));
  if (!authToken) {
    return {
      person: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const interactionAuth = await authorizeSpacePanelInteraction({
    spaceSlug,
    authToken,
  });
  if (!interactionAuth.authorized) {
    return {
      person: null,
      error: NextResponse.json(
        { error: interactionAuth.message ?? 'Forbidden' },
        { status: 403 },
      ),
    };
  }

  const person = await resolvePersonFromAuthToken(authToken);
  if (!person?.id) {
    return {
      person: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { person, error: null, authToken };
}
