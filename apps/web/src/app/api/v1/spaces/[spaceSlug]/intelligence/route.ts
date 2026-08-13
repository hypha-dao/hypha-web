import { NextRequest, NextResponse } from 'next/server';

import {
  findSpaceBySlug,
  listIntelligenceBySpaceSlug,
  writeIntelligenceBySpaceSlug,
  buildIntelligenceRelatedGraph,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

type Params = { spaceSlug: string };

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
  if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) {
      return { ok: false as const, response };
    }
  }
  return { ok: true as const, space };
}

function bearerFrom(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const gated = await gateSpace(request, spaceSlug);
    if (!gated.ok) return gated.response;

    const url = new URL(request.url);
    const listed = await listIntelligenceBySpaceSlug(
      {
        spaceSlug,
        type: url.searchParams.get('type') || undefined,
        status: url.searchParams.get('status') || undefined,
        search:
          url.searchParams.get('search') ||
          url.searchParams.get('q') ||
          undefined,
        authToken: bearerFrom(request),
      },
      { db },
    );

    if (listed.access === 'denied') {
      return NextResponse.json({ error: listed.message }, { status: 403 });
    }

    const graph = buildIntelligenceRelatedGraph(listed.artifacts);
    return NextResponse.json({
      space_slug: listed.space_slug,
      configured: listed.configured,
      artifacts: listed.artifacts,
      graph,
    });
  } catch (error) {
    console.error('GET intelligence', error);
    return NextResponse.json(
      { error: 'Failed to list space intelligence' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const gated = await gateSpace(request, spaceSlug);
    if (!gated.ok) return gated.response;

    const body = (await request.json()) as {
      markdown?: string;
      frontmatter?: Record<string, unknown>;
      body?: string;
      expectedSha?: string;
      source_app?: string;
    };

    const result = await writeIntelligenceBySpaceSlug(
      {
        spaceSlug,
        markdown: body.markdown,
        frontmatter: body.frontmatter as never,
        body: body.body,
        expectedSha: body.expectedSha,
        source_app: body.source_app,
        authToken: bearerFrom(request),
      },
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

    return NextResponse.json(
      {
        created: result.created,
        artifact: {
          path: result.artifact.path,
          sha: result.artifact.sha,
          frontmatter: result.artifact.frontmatter,
          body: result.artifact.body,
        },
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error('POST intelligence', error);
    return NextResponse.json(
      { error: 'Failed to write space intelligence' },
      { status: 500 },
    );
  }
}
