import { NextRequest, NextResponse } from 'next/server';

import {
  findSpaceBySlug,
  readIntelligenceBySpaceSlug,
  deleteIntelligenceBySpaceSlug,
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

export async function DELETE(
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

    let expectedSha = request.nextUrl.searchParams.get('expectedSha')?.trim();
    if (!expectedSha) {
      const body = (await request.json().catch(() => null)) as {
        expectedSha?: string;
        expected_sha?: string;
      } | null;
      expectedSha = body?.expectedSha?.trim() || body?.expected_sha?.trim();
    }
    if (!expectedSha) {
      return NextResponse.json(
        { error: 'expectedSha is required' },
        { status: 400 },
      );
    }

    const result = await deleteIntelligenceBySpaceSlug(
      { spaceSlug, artifactId, expectedSha, authToken: bearer },
      { db },
    );

    if (result.access === 'denied') {
      return NextResponse.json({ error: result.message }, { status: 403 });
    }
    if (result.access === 'conflict') {
      return NextResponse.json(
        { error: result.message, currentSha: result.currentSha },
        { status: 409 },
      );
    }
    if (result.access === 'misconfigured') {
      return NextResponse.json({ error: result.message }, { status: 503 });
    }

    return NextResponse.json({
      space_slug: result.space_slug,
      artifact_id: result.artifact_id,
      archived: true,
      sha: result.entry.sha,
    });
  } catch (error) {
    console.error('DELETE intelligence artifact', error);
    return NextResponse.json(
      { error: 'Failed to delete space intelligence artifact' },
      { status: 500 },
    );
  }
}
