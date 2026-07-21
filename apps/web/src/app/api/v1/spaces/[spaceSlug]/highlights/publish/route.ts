import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  findSpaceBySlug,
  mapHighlightProfileRow,
  readSpaceOnChainTransparency,
  schemaPublishHighlightProfile,
  setHighlightProfilePublished,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

type Params = { spaceSlug: string };

export async function PATCH(
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

    const parsed = schemaPublishHighlightProfile.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let discoverability: number | null = null;
    if (parsed.data.published && space.web3SpaceId != null) {
      try {
        const transparency = await readSpaceOnChainTransparency(
          space.web3SpaceId,
        );
        discoverability = transparency?.discoverability ?? null;
      } catch {
        discoverability = null;
      }
    }

    const result = await setHighlightProfilePublished(
      {
        spaceId: space.id,
        published: parsed.data.published,
        discoverability,
      },
      { db },
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Publish validation failed', errors: result.errors },
        { status: 400 },
      );
    }

    return NextResponse.json({
      profile: mapHighlightProfileRow(result.profile),
    });
  } catch (error) {
    console.error('Failed to publish highlights profile:', error);
    return NextResponse.json(
      { error: 'Failed to publish highlights profile' },
      { status: 500 },
    );
  }
}
