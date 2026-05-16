import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enqueueSignalEvaluationFromMemory,
  ingestSpaceCallArtifacts,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

const callArtifactIngestSchema = z.object({
  call_session_id: z.string().trim().min(1),
  recording: z
    .object({
      media_uri: z.string().trim().min(1),
      mime_type: z.string().trim().optional(),
      duration_seconds: z.number().int().nonnegative().optional(),
      started_at: z.string().trim().optional(),
      ended_at: z.string().trim().optional(),
      storage_key: z.string().trim().optional(),
      source: z.string().trim().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  transcript: z
    .object({
      language: z.string().trim().optional(),
      text: z.string().trim().min(1),
      summary: z.string().trim().optional(),
      source: z.string().trim().optional(),
      segments: z.array(z.record(z.string(), z.unknown())).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const ingestSecret = process.env.HYPHA_CALL_ARTIFACT_INGEST_SECRET?.trim();
  const suppliedSecret =
    request.headers.get('x-hypha-ingest-secret')?.trim() ??
    request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim() ??
    '';
  if (!ingestSecret || suppliedSecret !== ingestSecret) {
    return NextResponse.json(
      { error: 'Unauthorized ingest request' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const parsed = callArtifactIngestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await ingestSpaceCallArtifacts(
      {
        spaceSlug,
        callSessionId: parsed.data.call_session_id,
        recording: parsed.data.recording
          ? {
              mediaUri: parsed.data.recording.media_uri,
              mimeType: parsed.data.recording.mime_type,
              durationSeconds: parsed.data.recording.duration_seconds,
              startedAt: parsed.data.recording.started_at,
              endedAt: parsed.data.recording.ended_at,
              storageKey: parsed.data.recording.storage_key,
              source: parsed.data.recording.source,
              metadata: parsed.data.recording.metadata,
            }
          : undefined,
        transcript: parsed.data.transcript
          ? {
              language: parsed.data.transcript.language,
              text: parsed.data.transcript.text,
              summary: parsed.data.transcript.summary,
              source: parsed.data.transcript.source,
              segments: parsed.data.transcript.segments,
              metadata: parsed.data.transcript.metadata,
            }
          : undefined,
      },
      { db },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await enqueueSignalEvaluationFromMemory(
      {
        spaceSlug,
        triggerKind: 'memory_ingest',
      },
      { db },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[call-artifacts] Failed to ingest call artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to ingest call artifacts' },
      { status: 500 },
    );
  }
}
