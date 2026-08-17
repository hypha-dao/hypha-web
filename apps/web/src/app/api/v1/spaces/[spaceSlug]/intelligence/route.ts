import { NextRequest, NextResponse } from 'next/server';

import {
  authorizeIntelligenceSpace,
  findSpaceBySlug,
  listIntelligenceBySpaceSlug,
  writeIntelligenceBySpaceSlug,
  buildIntelligenceGraphForSpace,
  type WriteIntelligenceInput,
} from '@hypha-platform/core/server';
import type { IntelligenceGraph } from '@hypha-platform/core/intelligence';
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  field: string,
): { ok: true; value?: string } | { ok: false; error: string } {
  if (value === undefined) return { ok: true };
  if (typeof value !== 'string') {
    return { ok: false, error: `${field} must be a string` };
  }
  return { ok: true, value };
}

function parseWriteBody(raw: unknown):
  | {
      ok: true;
      value: {
        markdown?: string;
        frontmatter?: Record<string, unknown>;
        body?: string;
        expectedSha?: string;
        source_app?: string;
      };
    }
  | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const markdown = optionalString(raw.markdown, 'markdown');
  const body = optionalString(raw.body, 'body');
  const expectedSha = optionalString(raw.expectedSha, 'expectedSha');
  const sourceApp = optionalString(raw.source_app, 'source_app');
  if (!markdown.ok) return markdown;
  if (!body.ok) return body;
  if (!expectedSha.ok) return expectedSha;
  if (!sourceApp.ok) return sourceApp;

  if (raw.frontmatter !== undefined && !isPlainObject(raw.frontmatter)) {
    return { ok: false, error: 'frontmatter must be an object' };
  }

  return {
    ok: true,
    value: {
      markdown: markdown.value,
      frontmatter: raw.frontmatter,
      body: body.value,
      expectedSha: expectedSha.value,
      source_app: sourceApp.value,
    },
  };
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
        includeArchived:
          url.searchParams.get('includeArchived') === '1' ||
          url.searchParams.get('includeArchived') === 'true',
        authToken: bearerFrom(request),
      },
      { db },
    );

    if (listed.access === 'denied') {
      return NextResponse.json({ error: listed.message }, { status: 403 });
    }

    let graph: IntelligenceGraph = { nodes: [], edges: [] };
    try {
      graph = await buildIntelligenceGraphForSpace(
        {
          spaceSlug,
          artifacts: listed.artifacts,
        },
        { db },
      );
    } catch (graphError) {
      console.error('GET intelligence graph', graphError);
    }
    return NextResponse.json({
      space_slug: listed.space_slug,
      configured: listed.configured,
      artifacts: listed.artifacts,
      enabled_packs: listed.enabled_packs,
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

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const parsed = parseWriteBody(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await writeIntelligenceBySpaceSlug(
      {
        spaceSlug,
        markdown: parsed.value.markdown,
        frontmatter: parsed.value
          .frontmatter as WriteIntelligenceInput['frontmatter'],
        body: parsed.value.body,
        expectedSha: parsed.value.expectedSha,
        source_app: parsed.value.source_app,
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
