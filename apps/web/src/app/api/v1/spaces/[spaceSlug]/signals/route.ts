import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  buildAiSignalNavigation,
  createCoherence,
  findCoherenceBySourceExternalId,
  findSpaceActorPerson,
  isUniqueViolation,
  normalizeCoherence,
  schemaIngestSignal,
  type Coherence,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authorizeIngestion,
  resolveSignalAuthorOrSpace,
} from './_lib/authorize-ingestion';
import { withExternalTag } from './_lib/external-signal-tag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { spaceSlug: string };

/**
 * Who the board credits for a signal: the reported author when Hypha knows
 * them, otherwise the space itself.
 */
type Attribution = 'author' | 'space';

function toIngestionResponse(
  request: NextRequest,
  signal: Coherence,
  spaceSlug: string,
  attributedTo: Attribution,
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
    attributedTo,
    signal,
  };
}

/**
 * The `200` answer for an `externalId` this integration has already ingested,
 * or null when it has not. Attribution is recovered by comparing the stored
 * creator against the space actor, since the original payload is long gone.
 */
async function respondWithExistingSignal(
  request: NextRequest,
  key: { spaceId: number; source: string; externalId: string },
  space: { slug: string },
) {
  const existing = await findCoherenceBySourceExternalId(key, { db });
  if (!existing) return null;

  const spaceActor = await findSpaceActorPerson(
    { spaceId: key.spaceId },
    { db },
  );
  return NextResponse.json(
    toIngestionResponse(
      request,
      normalizeCoherence(existing),
      space.slug,
      existing.creatorId === spaceActor?.id ? 'space' : 'author',
    ),
    { status: 200 },
  );
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

    const replayKey = payload.externalId
      ? {
          spaceId: space.id,
          source: apiKey.source,
          externalId: payload.externalId,
        }
      : null;

    // Replay check first, so a repeated request neither writes nor creates the
    // space actor person that attribution may fall back to.
    if (replayKey) {
      const replay = await respondWithExistingSignal(request, replayKey, space);
      if (replay) return replay;
    }

    const author = await resolveSignalAuthorOrSpace(payload.author, space);

    let created: Awaited<ReturnType<typeof createCoherence>>;
    try {
      created = await createCoherence(
        {
          creatorId: author.personId,
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
    } catch (error) {
      // Two retries can race past the replay check; the unique index is what
      // actually makes ingestion idempotent, so honour it as a replay too. The
      // lookup below is the real test of which constraint fired: any other one
      // finds no row and falls through to the error response.
      if (replayKey && isUniqueViolation(error)) {
        const replay = await respondWithExistingSignal(
          request,
          replayKey,
          space,
        );
        if (replay) return replay;
      }
      throw error;
    }

    return NextResponse.json(
      toIngestionResponse(
        request,
        normalizeCoherence(created),
        space.slug,
        author.attributedToSpace ? 'space' : 'author',
      ),
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
