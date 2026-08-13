import { NextRequest, NextResponse } from 'next/server';

import {
  findSpaceBySlug,
  readIntelligenceBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

type Params = { spaceSlug: string; artifactId: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, artifactId } = await params;
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

    const authHeader = request.headers.get('authorization');
    const bearer =
      authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || undefined;

    const result = await readIntelligenceBySpaceSlug(
      { spaceSlug, artifactId, authToken: bearer },
      { db },
    );

    if (result.access === 'denied') {
      return NextResponse.json({ error: result.message }, { status: 403 });
    }
    if (!result.artifact) {
      return NextResponse.json(
        { error: 'Artifact not found', configured: result.configured },
        { status: 404 },
      );
    }

    return NextResponse.json({
      space_slug: result.space_slug,
      configured: result.configured,
      artifact: {
        path: result.artifact.path,
        sha: result.artifact.sha,
        frontmatter: result.artifact.frontmatter,
        body: result.artifact.body,
      },
    });
  } catch (error) {
    console.error('GET intelligence artifact', error);
    return NextResponse.json(
      { error: 'Failed to read space intelligence artifact' },
      { status: 500 },
    );
  }
}
