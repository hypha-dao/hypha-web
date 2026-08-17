import { NextRequest, NextResponse } from 'next/server';

import {
  authorizeIntelligenceSpace,
  findSpaceBySlug,
  readIntelligenceBySpaceSlug,
  deleteIntelligenceBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { spaceSlug: string; artifactId: string };

function bearerFrom(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  return authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || undefined;
}

async function gateSpace(request: NextRequest, spaceSlug: string) {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Space not found' },
        { status: 404 },
      ),
    };
  }
  const gate = await authorizeIntelligenceSpace(space, bearerFrom(request));
  if (!gate.hasAccess) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: gate.message },
        { status: gate.httpStatus },
      ),
    };
  }
  return { ok: true as const, space };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, artifactId } = await params;
  try {
    const gated = await gateSpace(request, spaceSlug);
    if (!gated.ok) return gated.response;

    const bearer = bearerFrom(request);

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
    const gated = await gateSpace(request, spaceSlug);
    if (!gated.ok) return gated.response;

    const bearer = bearerFrom(request);

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
