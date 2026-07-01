import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  buildPaginatedResponse,
  findCoherenceBySlug,
  findSpaceBySlug,
  normalizeCoherence,
  parseHttpPaginationParams,
  patchCoherenceTaskBySlugAction,
  schemaPatchCoherenceTaskBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

type Params = { spaceSlug: string; slug: string };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, slug } = await params;
  const authToken = parseBearerToken(request.headers.get('Authorization'));
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const interactionAuth = await authorizeSpacePanelInteraction({
      spaceSlug,
      authToken,
    });
    if (!interactionAuth.authorized) {
      return NextResponse.json(
        { error: interactionAuth.message },
        { status: 403 },
      );
    }

    const existing = await findCoherenceBySlug({ slug }, { db });
    if (!existing || existing.spaceId !== space.id) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schemaPatchCoherenceTaskBySlug.safeParse({
      slug,
      ...(typeof body === 'object' && body != null ? body : {}),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await patchCoherenceTaskBySlugAction(parsed.data, {
      authToken,
    });
    return NextResponse.json(normalizeCoherence(updated));
  } catch (error) {
    console.error('Failed to patch signal task:', error);
    return NextResponse.json(
      { error: 'Failed to patch signal task' },
      { status: 500 },
    );
  }
}
