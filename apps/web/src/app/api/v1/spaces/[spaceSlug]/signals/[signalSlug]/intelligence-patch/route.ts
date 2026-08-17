import { NextRequest, NextResponse } from 'next/server';

import {
  authorizeIntelligenceSpace,
  findSpaceBySlug,
  getIntelligencePatchForSignal,
  proposeIntelligencePatchForSignal,
  approveIntelligencePatchForSignal,
  rejectIntelligencePatchForSignal,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { spaceSlug: string; signalSlug: string };

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

function bearerFrom(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, signalSlug } = await params;
  try {
    const gated = await gateSpace(request, spaceSlug);
    if (!gated.ok) return gated.response;

    const result = await getIntelligencePatchForSignal(
      {
        spaceSlug,
        signalSlug,
        authToken: bearerFrom(request),
      },
      { db },
    );

    if (result.access === 'denied') {
      return NextResponse.json({ error: result.message }, { status: 403 });
    }
    if (result.access === 'misconfigured') {
      return NextResponse.json({ error: result.message }, { status: 503 });
    }

    return NextResponse.json({
      space_slug: result.space_slug,
      configured: result.configured,
      patch: result.patch,
    });
  } catch (error) {
    console.error('GET intelligence-patch', error);
    return NextResponse.json(
      { error: 'Failed to load intelligence patch' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, signalSlug } = await params;
  try {
    const gated = await gateSpace(request, spaceSlug);
    if (!gated.ok) return gated.response;

    const body = (await request.json()) as {
      action?: 'propose' | 'approve' | 'reject';
      target_id?: string;
      expected_sha?: string;
      markdown?: string;
      source_app?: string;
      title?: string;
    };

    const action = body.action ?? 'propose';
    const authToken = bearerFrom(request);

    if (action === 'propose') {
      if (!body.target_id || !body.expected_sha || !body.markdown) {
        return NextResponse.json(
          {
            error:
              'propose requires target_id, expected_sha, and markdown (full proposed artifact).',
          },
          { status: 400 },
        );
      }
      const result = await proposeIntelligencePatchForSignal(
        {
          spaceSlug,
          signalSlug,
          targetId: body.target_id,
          expectedSha: body.expected_sha,
          markdown: body.markdown,
          source_app: body.source_app,
          title: body.title,
          authToken,
        },
        { db },
      );
      if (result.access === 'denied') {
        return NextResponse.json({ error: result.message }, { status: 403 });
      }
      if (result.access === 'misconfigured') {
        return NextResponse.json({ error: result.message }, { status: 503 });
      }
      if (result.access === 'conflict') {
        return NextResponse.json(
          { error: result.message, currentSha: result.currentSha },
          { status: 409 },
        );
      }
      return NextResponse.json({
        space_slug: result.space_slug,
        patch: result.patch,
      });
    }

    if (action === 'approve') {
      const result = await approveIntelligencePatchForSignal(
        {
          spaceSlug,
          signalSlug,
          markdown: body.markdown,
          authToken,
        },
        { db },
      );
      if (result.access === 'denied') {
        return NextResponse.json({ error: result.message }, { status: 403 });
      }
      if (result.access === 'misconfigured') {
        return NextResponse.json({ error: result.message }, { status: 503 });
      }
      if (result.access === 'conflict') {
        return NextResponse.json(
          { error: result.message, currentSha: result.currentSha },
          { status: 409 },
        );
      }
      return NextResponse.json({
        space_slug: result.space_slug,
        patch: result.patch,
        artifact_id: result.artifactId,
        sha: result.sha,
      });
    }

    if (action === 'reject') {
      const result = await rejectIntelligencePatchForSignal(
        { spaceSlug, signalSlug, authToken },
        { db },
      );
      if (result.access === 'denied') {
        return NextResponse.json({ error: result.message }, { status: 403 });
      }
      if (result.access === 'misconfigured') {
        return NextResponse.json({ error: result.message }, { status: 503 });
      }
      return NextResponse.json({
        space_slug: result.space_slug,
        patch: result.patch,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use propose, approve, or reject.' },
      { status: 400 },
    );
  } catch (error) {
    console.error('POST intelligence-patch', error);
    return NextResponse.json(
      { error: 'Failed to process intelligence patch' },
      { status: 500 },
    );
  }
}
