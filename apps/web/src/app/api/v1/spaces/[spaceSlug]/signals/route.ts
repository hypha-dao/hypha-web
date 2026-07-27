import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  buildAiSignalNavigation,
  createCoherence,
  findCoherenceBySourceExternalId,
  normalizeCoherence,
  schemaIngestSignal,
  type Coherence,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authorNotFoundResponse,
  authorizeIngestion,
  resolveSignalAuthor,
} from './_lib/authorize-ingestion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { spaceSlug: string };

/** Marks every ingested signal so the board can filter on provenance. */
const EXTERNAL_SIGNAL_TAG = 'External Signal';

function withExternalTag(tags: string[]): string[] {
  const alreadyTagged = tags.some(
    (tag) => tag.trim().toLowerCase() === EXTERNAL_SIGNAL_TAG.toLowerCase(),
  );
  return alreadyTagged ? tags : [...tags, EXTERNAL_SIGNAL_TAG];
}

function toIngestionResponse(
  request: NextRequest,
  signal: Coherence,
  spaceSlug: string,
) {
  const signalSlug = signal.slug ?? '';
  const { href } = buildAiSignalNavigation({
    spaceSlug,
    signalSlug,
    signalTitle: signal.title,
    roomId: signal.roomId,
  });

  return {
    id: signal.id,
    slug: signalSlug,
    spaceSlug,
    url: new URL(href, request.url).toString(),
    signal,
  };
}

/**
 * Ingest a signal produced by a community's own app. The row lands in the same
 * `coherences` table the Signals Board reads, so it appears on the board with
 * no further work.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const authorized = await authorizeIngestion(
      request,
      spaceSlug,
      'signals:write',
    );
    if ('response' in authorized) return authorized.response;
    const { space, apiKey } = authorized.context;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let payload: ReturnType<typeof schemaIngestSignal.parse>;
    try {
      payload = schemaIngestSignal.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.flatten() },
          { status: 400 },
        );
      }
      throw error;
    }

    const author = await resolveSignalAuthor(payload.author);
    if (!author?.id) {
      return authorNotFoundResponse(payload.author);
    }

    if (payload.externalId) {
      const existing = await findCoherenceBySourceExternalId(
        {
          spaceId: space.id,
          source: apiKey.source,
          externalId: payload.externalId,
        },
        { db },
      );
      if (existing) {
        return NextResponse.json(
          toIngestionResponse(
            request,
            normalizeCoherence(existing),
            space.slug,
          ),
          { status: 200 },
        );
      }
    }

    const created = await createCoherence(
      {
        creatorId: author.id,
        spaceId: space.id,
        type: payload.type,
        priority: payload.priority,
        title: payload.title,
        description: payload.description,
        tags: withExternalTag(payload.tags),
        archived: false,
        dueAt: payload.dueAt,
        progressStatus: payload.progressStatus,
        board: payload.board,
        source: apiKey.source,
        externalId: payload.externalId ?? null,
      },
      { db },
    );

    return NextResponse.json(
      toIngestionResponse(request, normalizeCoherence(created), space.slug),
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Workflow validation rejects unknown statuses and boards for the space.
    if (/^Unknown (progress status|board)/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Failed to ingest signal:', { spaceSlug, message });
    return NextResponse.json(
      { error: 'Failed to ingest signal' },
      { status: 500 },
    );
  }
}
