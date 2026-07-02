import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  normalizeCoherence,
  patchCoherenceTaskBySlugAction,
  resolveCoherenceTaskPatchContext,
  schemaPatchCoherenceTaskBySlug,
} from '@hypha-platform/core/server';
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
    const context = await resolveCoherenceTaskPatchContext({ spaceSlug, slug });
    if (!context.ok) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const bodyRecord =
      typeof body === 'object' && body != null
        ? (body as Record<string, unknown>)
        : {};
    const { slug: _ignoredSlug, ...bodyWithoutSlug } = bodyRecord;
    const parsed = schemaPatchCoherenceTaskBySlug.safeParse({
      ...bodyWithoutSlug,
      slug,
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
