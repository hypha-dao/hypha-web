import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  listIntelligenceBySpaceSlug,
  writeIntelligenceBySpaceSlug,
  buildIntelligenceGraphForSpace,
} from '@hypha-platform/core/server';
import {
  slugifyIntelligenceId,
  type IntelligenceGraph,
} from '@hypha-platform/core/intelligence';
import { db } from '@hypha-platform/storage-postgres';
import {
  authorizeIntelligenceRequest,
  intelligenceWriteFlags,
  type IntelligenceHttpAuth,
} from './_lib/authorize-intelligence';

type Params = { spaceSlug: string };

const ibaCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    type: z.string().trim().min(1).max(64).optional(),
    body: z.string().max(400_000).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    related: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    linked_signals: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .optional(),
    id: z.string().trim().min(1).max(80).optional(),
    markdown: z.string().min(1).max(400_000).optional(),
    source_app: z.string().trim().min(1).max(200).optional(),
    mode: z.enum(['draft', 'publish']).optional(),
    expectedSha: z.string().optional(),
    expected_sha: z.string().optional(),
    frontmatter: z.record(z.unknown()).optional(),
  })
  .strict();

function writeErrorResponse(result: {
  access: 'denied' | 'conflict' | 'misconfigured';
  message: string;
  currentSha?: string;
}) {
  if (result.access === 'conflict') {
    return NextResponse.json(
      { error: result.message, currentSha: result.currentSha },
      { status: 409 },
    );
  }
  if (result.access === 'misconfigured') {
    return NextResponse.json({ error: result.message }, { status: 503 });
  }
  return NextResponse.json({ error: result.message }, { status: 403 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const gated = await authorizeIntelligenceRequest(
      request,
      spaceSlug,
      'read',
    );
    if ('response' in gated) return gated.response;

    const url = new URL(request.url);
    const flags = intelligenceWriteFlags(gated.auth);
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
        authToken: flags.authToken,
        skipMembershipCheck: flags.skipMembershipCheck,
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

function ibaCreateDenied(
  auth: IntelligenceHttpAuth,
  body: z.infer<typeof ibaCreateSchema>,
): NextResponse | null {
  if (auth.kind !== 'iba') return null;
  if (body.mode === 'publish') {
    return NextResponse.json(
      {
        error: 'Intelligence API keys cannot publish; create a draft instead.',
      },
      { status: 403 },
    );
  }
  if (body.expectedSha || body.expected_sha) {
    return NextResponse.json(
      {
        error:
          'Intelligence API keys cannot update published artifacts. Create a draft, or propose a patch from a signal.',
      },
      { status: 403 },
    );
  }
  if (body.source_app && body.source_app !== auth.apiKey.source) {
    return NextResponse.json(
      {
        error: `source_app "${body.source_app}" does not match authenticated app identity "${auth.apiKey.source}".`,
      },
      { status: 403 },
    );
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const gated = await authorizeIntelligenceRequest(
      request,
      spaceSlug,
      'write',
    );
    if ('response' in gated) return gated.response;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const flags = intelligenceWriteFlags(gated.auth);

    if (gated.auth.kind === 'iba') {
      const parsed = ibaCreateSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      const denied = ibaCreateDenied(gated.auth, parsed.data);
      if (denied) return denied;

      const title = parsed.data.title?.trim();
      const type = parsed.data.type?.trim();
      const markdown = parsed.data.markdown?.trim();

      if (title && type) {
        const result = await writeIntelligenceBySpaceSlug(
          {
            spaceSlug,
            frontmatter: {
              id: slugifyIntelligenceId(parsed.data.id || title),
              type,
              title,
              source_app: gated.auth.apiKey.source,
              status: 'draft',
              tags: parsed.data.tags,
              related: parsed.data.related,
              linked_signals: parsed.data.linked_signals,
            },
            body: parsed.data.body ?? '',
            skipMembershipCheck: true,
            canonicalSourceApp: gated.auth.apiKey.source,
            createOnly: true,
            forceStatus: 'draft',
          },
          { db },
        );
        if (result.access !== 'ok') return writeErrorResponse(result);
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
      }

      if (!markdown) {
        return NextResponse.json(
          {
            error:
              'Provide title and type (and body), or markdown with YAML frontmatter.',
          },
          { status: 400 },
        );
      }

      const result = await writeIntelligenceBySpaceSlug(
        {
          spaceSlug,
          markdown,
          skipMembershipCheck: true,
          canonicalSourceApp: gated.auth.apiKey.source,
          createOnly: true,
          forceStatus: 'draft',
        },
        { db },
      );

      if (result.access !== 'ok') return writeErrorResponse(result);

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
    }

    const body = rawBody as {
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
        authToken: flags.authToken,
      },
      { db },
    );

    if (result.access !== 'ok') return writeErrorResponse(result);

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
