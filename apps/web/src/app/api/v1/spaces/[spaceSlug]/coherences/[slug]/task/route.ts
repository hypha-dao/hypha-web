import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findCoherenceBySlug,
  findSpaceBySlug,
  normalizeCoherence,
  patchCoherenceTaskBySlugAction,
  schemaPatchCoherenceTaskBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { spaceSlug: string; slug: string };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, slug } = await params;
  const authToken = request.headers.get('Authorization')?.split(' ')[1];
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

    const body = await request.json();
    const parsed = schemaPatchCoherenceTaskBySlug.safeParse({ slug, ...body });
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
      {
        error:
          error instanceof Error ? error.message : 'Failed to patch signal task',
      },
      { status: 500 },
    );
  }
}
