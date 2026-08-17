import { NextRequest, NextResponse } from 'next/server';

import {
  authorizeIntelligenceSpace,
  findSpaceBySlug,
  enableIntelligencePackForSpace,
  listIntelligenceBySpaceSlug,
  listIntelligencePackCatalogs,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

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
  const { spaceSlug } = await params;
  try {
    const gated = await gateSpace(request, spaceSlug);
    if (!gated.ok) return gated.response;

    const listed = await listIntelligenceBySpaceSlug(
      { spaceSlug, authToken: bearerFrom(request) },
      { db },
    );
    if (listed.access === 'denied') {
      return NextResponse.json({ error: listed.message }, { status: 403 });
    }

    const existingIds = new Set(listed.artifact_ids);

    return NextResponse.json({
      space_slug: listed.space_slug,
      configured: listed.configured,
      enabled_packs: listed.enabled_packs,
      available: listIntelligencePackCatalogs().map((pack) => ({
        id: pack.id,
        title: pack.title,
        description: pack.description,
        version: pack.version,
        template_count: pack.templates.length,
        templates: pack.templates.map((template) => ({
          id: template.id,
          type: template.type,
          title: template.title,
          pack_alias: template.pack_alias,
          tags: template.tags,
          body: template.body,
          activated: existingIds.has(template.id),
        })),
      })),
    });
  } catch (error) {
    console.error('GET intelligence packs', error);
    return NextResponse.json(
      { error: 'Failed to list intelligence packs' },
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
      pack_id?: string;
      template_id?: string;
    };
    if (!body.pack_id?.trim()) {
      return NextResponse.json(
        { error: 'pack_id is required.' },
        { status: 400 },
      );
    }

    const result = await enableIntelligencePackForSpace(
      {
        spaceSlug,
        packId: body.pack_id,
        templateId: body.template_id?.trim() || undefined,
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
      pack_id: result.pack_id,
      enabled_packs: result.enabled_packs,
      seeded: result.seeded,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('POST intelligence packs', error);
    return NextResponse.json(
      { error: 'Failed to enable intelligence pack' },
      { status: 500 },
    );
  }
}
