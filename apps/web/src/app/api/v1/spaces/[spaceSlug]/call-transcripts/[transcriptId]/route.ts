import { NextRequest, NextResponse } from 'next/server';

import {
  findSpaceBySlug,
  getSpaceCallTranscriptForMember,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { parseBearerToken } from '@web/utils/parse-bearer-token';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

type Params = { spaceSlug: string; transcriptId: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, transcriptId: rawId } = await params;
  const transcriptId = Number(rawId);
  if (!Number.isSafeInteger(transcriptId) || transcriptId < 1) {
    return NextResponse.json(
      { error: 'Invalid transcript id' },
      { status: 400 },
    );
  }

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

    const authToken = parseBearerToken(request.headers.get('authorization'));
    const gated = await getSpaceCallTranscriptForMember(
      { spaceSlug, transcriptId },
      { db, authToken },
    );
    if (gated.access === 'denied') {
      return NextResponse.json({ error: gated.message }, { status: 403 });
    }
    if (!gated.transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 },
      );
    }
    return NextResponse.json(gated.transcript, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to fetch call transcript:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call transcript' },
      { status: 500 },
    );
  }
}
