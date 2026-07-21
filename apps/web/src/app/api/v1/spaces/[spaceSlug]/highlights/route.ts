import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findHighlightProfileBySpaceId,
  findSpaceBySlug,
  findStoryCoherencesBySpaceId,
  mapHighlightProfileRow,
  sanitizeSupportActionsForPublic,
  schemaUpsertHighlightProfile,
  upsertHighlightProfile,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

type Params = { spaceSlug: string };

async function canEditHighlights(spaceSlug: string, authToken: string | null) {
  if (!authToken) return false;
  const result = await authorizeSpacePanelInteraction({
    spaceSlug,
    authToken,
  });
  return result.authorized;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const authToken = parseBearerToken(request.headers.get('Authorization'));
    const editAllowed = await canEditHighlights(spaceSlug, authToken);
    const row = await findHighlightProfileBySpaceId(space.id, { db });
    const published = row?.published ?? false;

    // Unpublished profiles are member/delegate only; published are public.
    if (!published && !editAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stories = await findStoryCoherencesBySpaceId(space.id, { db });
    const profile = row ? mapHighlightProfileRow(row) : null;

    if (profile && !editAllowed) {
      profile.supportActions = sanitizeSupportActionsForPublic(
        profile.supportActions,
      );
    }

    return NextResponse.json({
      found: !!row,
      space: {
        slug: space.slug,
        title: space.title,
        logoUrl: space.logoUrl ?? null,
        leadImage: space.leadImage ?? null,
        locationLabel: space.locationLabel ?? null,
      },
      profile,
      stories,
      canEdit: editAllowed,
    });
  } catch (error) {
    console.error('Failed to fetch highlights profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch highlights profile' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schemaUpsertHighlightProfile.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const row = await upsertHighlightProfile(
      { spaceId: space.id, ...parsed.data },
      { db },
    );
    const stories = await findStoryCoherencesBySpaceId(space.id, { db });

    return NextResponse.json({
      found: true,
      space: {
        slug: space.slug,
        title: space.title,
        logoUrl: space.logoUrl ?? null,
        leadImage: space.leadImage ?? null,
        locationLabel: space.locationLabel ?? null,
      },
      profile: mapHighlightProfileRow(row),
      stories,
      canEdit: true,
    });
  } catch (error) {
    console.error('Failed to update highlights profile:', error);
    return NextResponse.json(
      { error: 'Failed to update highlights profile' },
      { status: 500 },
    );
  }
}
