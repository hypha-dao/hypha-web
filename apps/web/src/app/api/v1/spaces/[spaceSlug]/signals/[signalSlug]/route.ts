import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  normalizeCoherence,
  schemaPatchIngestedSignal,
  updateCoherenceBySlug,
  updateCoherenceSignalBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authorizeIngestion,
  loadOwnedSignal,
} from '../_lib/authorize-ingestion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { spaceSlug: string; signalSlug: string };

/**
 * Update a signal this integration previously ingested. Signals created in the
 * Hypha UI, or by another integration, are not writable through this route.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, signalSlug } = await params;

  try {
    const authorized = await authorizeIngestion(
      request,
      spaceSlug,
      'signals:write',
    );
    if ('response' in authorized) return authorized.response;
    const { space, apiKey } = authorized.context;

    const owned = await loadOwnedSignal({ signalSlug, space, apiKey });
    if ('response' in owned) return owned.response;
    const { signal } = owned;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let patch: ReturnType<typeof schemaPatchIngestedSignal.parse>;
    try {
      patch = schemaPatchIngestedSignal.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.flatten() },
          { status: 400 },
        );
      }
      throw error;
    }

    // `updateCoherenceSignalBySlug` writes the full signal, so unspecified
    // fields are carried over from the stored row rather than reset.
    let updated = await updateCoherenceSignalBySlug(
      {
        slug: signalSlug,
        requesterPersonId: signal.creatorId,
        type: patch.type ?? signal.type,
        priority: patch.priority ?? signal.priority,
        title: patch.title ?? signal.title,
        description: patch.description ?? signal.description,
        tags: patch.tags ?? signal.tags,
        dueAt: patch.dueAt === undefined ? signal.dueAt : patch.dueAt,
        progressStatus:
          patch.progressStatus === undefined
            ? signal.progressStatus
            : patch.progressStatus,
        board: patch.board === undefined ? signal.board : patch.board,
        assigneeIds: signal.assigneeIds,
      },
      { db },
    );

    if (patch.archived !== undefined && patch.archived !== signal.archived) {
      updated = await updateCoherenceBySlug(
        { slug: signalSlug, archived: patch.archived },
        { db },
      );
    }

    return NextResponse.json({
      id: updated.id,
      slug: updated.slug,
      spaceSlug: space.slug,
      signal: normalizeCoherence(updated),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/^Unknown (progress status|board)/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Failed to update ingested signal:', {
      spaceSlug,
      signalSlug,
      message,
    });
    return NextResponse.json(
      { error: 'Failed to update signal' },
      { status: 500 },
    );
  }
}
