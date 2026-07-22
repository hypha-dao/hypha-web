import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
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

  // Reuse the person resolved during authorization instead of verifying the
  // token a second time.
  return { person: interactionAuth.person, error: null, authToken };
}
