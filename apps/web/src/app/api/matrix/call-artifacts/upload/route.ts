import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import { coherences, db } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  determineEnvironment,
  enqueueSignalEvaluationFromMemory,
  findSpaceHostFieldsBySlug,
  getSpaceCallRecordingBySessionId,
  ingestSpaceCallArtifacts,
  recordSpaceCallArtifactIngestEvent,
} from '@hypha-platform/core/server';
import {
  resolveMatrixAccessToken,
  verifyPrivyToken,
} from '../../room-call-permissions/_lib';

type MatrixMediaUploadResponse = {
  content_uri?: string;
};

const MAX_RECORDING_UPLOAD_BYTES = 100 * 1024 * 1024;

function logCallArtifactsUpload(
  event: string,
  payload: Record<string, unknown>,
) {
  console.info('[matrix.call-artifacts.upload]', {
    event,
    ...payload,
  });
}

async function trackIngestState(
  {
    spaceId,
    callSessionId,
    state,
    incrementAttempts = false,
    nextRetryAt = null,
    lastError = null,
    recordingStored,
    transcriptStored,
    metadata,
  }: {
    spaceId: number;
    callSessionId: string;
    state: 'pending' | 'uploading' | 'ingested' | 'failed' | 'retry_pending';
    incrementAttempts?: boolean;
    nextRetryAt?: string | null;
    lastError?: string | null;
    recordingStored?: boolean;
    transcriptStored?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await recordSpaceCallArtifactIngestEvent(
      {
        spaceId,
        callSessionId,
        state,
        incrementAttempts,
        nextRetryAt,
        lastError,
        recordingStored,
        transcriptStored,
        metadata,
      },
      { db },
    );
  } catch (error) {
    console.error('[matrix.call-artifacts.upload] ingest state tracking failed', {
      spaceId,
      callSessionId,
      state,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function isSpaceLinkedCallRoom(params: {
  spaceId: number;
  spaceChatRoomId: string | null | undefined;
  roomId: string;
}) {
  const { spaceId, spaceChatRoomId, roomId } = params;
  if (spaceChatRoomId?.trim() === roomId) return true;
  const [linkedSignal] = await db
    .select({ id: coherences.id })
    .from(coherences)
    .where(and(eq(coherences.spaceId, spaceId), eq(coherences.roomId, roomId)))
    .limit(1);
  return Boolean(linkedSignal);
}

async function triggerTranscriptJob(payload: {
  spaceSlug: string;
  roomId: string;
  callSessionId: string;
  mediaUri: string;
  mimeType: string;
  startedAt?: string;
  endedAt?: string;
}) {
  const jobUrl = process.env.HYPHA_CALL_TRANSCRIPT_JOB_URL?.trim();
  if (!jobUrl) {
    return { attempted: false as const, ok: false as const, status: null };
  }
  const jobSecret = process.env.HYPHA_CALL_TRANSCRIPT_JOB_SECRET?.trim();
  const response = await fetch(jobUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jobSecret ? { Authorization: `Bearer ${jobSecret}` } : {}),
    },
    body: JSON.stringify({
      space_slug: payload.spaceSlug,
      room_id: payload.roomId,
      call_session_id: payload.callSessionId,
      recording: {
        media_uri: payload.mediaUri,
        mime_type: payload.mimeType,
        started_at: payload.startedAt,
        ended_at: payload.endedAt,
      },
      trigger: 'live_call_upload',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return {
    attempted: true as const,
    ok: response.ok,
    status: response.status,
  };
}

async function persistTranscriptOnly(params: {
  spaceSlug: string;
  callSessionId: string;
  transcriptText: string;
}) {
  const { spaceSlug, callSessionId, transcriptText } = params;
  const transcriptResult = await ingestSpaceCallArtifacts(
    {
      spaceSlug,
      callSessionId,
      transcript: {
        text: transcriptText,
        source: 'browser_speech_recognition',
        metadata: {
          capture: 'automatic_in_call',
        },
      },
    },
    { db },
  );
  return transcriptResult;
}

export async function POST(request: NextRequest) {
  const humanChatEnabled = await getEnableHumanChat();
  const authHeader = request.headers.get('Authorization');
  if (!humanChatEnabled || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authToken = authHeader.slice('Bearer '.length).trim();
  const privyUserId = await verifyPrivyToken(authToken);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const spaceSlug = request.nextUrl.searchParams.get('spaceSlug')?.trim();
  if (!spaceSlug) {
    return NextResponse.json(
      { error: 'spaceSlug is required' },
      { status: 400 },
    );
  }

  const form = await request.formData().catch(() => null);
  const roomId = String(form?.get('room_id') ?? '').trim();
  const callSessionId =
    String(form?.get('call_session_id') ?? '').trim() || randomUUID();
  const recording = form?.get('recording');
  const transcriptText = String(form?.get('transcript_text') ?? '').trim();
  const mimeType = String(form?.get('mime_type') ?? '').trim() || 'video/webm';
  const startedAt = String(form?.get('started_at') ?? '').trim();
  const endedAt = String(form?.get('ended_at') ?? '').trim();
  const hasRecordingBlob = recording instanceof Blob && recording.size > 0;
  logCallArtifactsUpload('request_received', {
    spaceSlug,
    roomId,
    callSessionId,
    hasRecordingBlob,
    hasTranscriptText: Boolean(transcriptText),
  });

  if (!roomId || (!hasRecordingBlob && !transcriptText)) {
    return NextResponse.json(
      {
        error:
          'room_id and either a recording blob or transcript_text are required',
      },
      { status: 400 },
    );
  }
  if (hasRecordingBlob && recording.size > MAX_RECORDING_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Recording exceeds max upload size (${MAX_RECORDING_UPLOAD_BYTES} bytes)`,
      },
      { status: 413 },
    );
  }

  const space = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  const linkedRoom = space
    ? await isSpaceLinkedCallRoom({
        spaceId: space.id,
        spaceChatRoomId: space.chatRoomId,
        roomId,
      })
    : false;
  if (!space || !linkedRoom) {
    logCallArtifactsUpload('space_room_mismatch', {
      spaceSlug,
      roomId,
      callSessionId,
      hasSpace: Boolean(space),
      linkedRoom,
    });
    return NextResponse.json({ error: 'Space/room mismatch' }, { status: 404 });
  }
  await trackIngestState({
    spaceId: space.id,
    callSessionId,
    state: 'pending',
    metadata: {
      roomId,
      hasRecordingBlob,
      hasTranscriptText: Boolean(transcriptText),
    },
  });

  const access = await checkSpaceAccessForSpace(space, authToken);
  if (!access.hasAccess) {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }

  const existingRecording = await getSpaceCallRecordingBySessionId(
    { spaceId: space.id, callSessionId },
    { db },
  );
  if (existingRecording?.mediaUri?.trim()) {
    if (transcriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug,
        callSessionId,
        transcriptText,
      });
      if (!transcriptResult.ok) {
        return NextResponse.json(
          { error: transcriptResult.error },
          { status: 400 },
        );
      }
    }
    logCallArtifactsUpload('deduped_existing_recording', {
      spaceSlug,
      roomId,
      callSessionId,
      transcriptStored: Boolean(transcriptText),
    });
    await trackIngestState({
      spaceId: space.id,
      callSessionId,
      state: 'ingested',
      recordingStored: true,
      transcriptStored: Boolean(transcriptText),
      metadata: {
        deduped: true,
      },
    });
    return NextResponse.json({
      ok: true,
      media_uri: existingRecording.mediaUri,
      call_session_id: callSessionId,
      recording_stored: true,
      transcript_stored: Boolean(transcriptText),
      transcript_job: {
        attempted: false,
        ok: false,
        status: null,
      },
      deduped: true,
    });
  }

  if (!hasRecordingBlob) {
    const transcriptResult = await persistTranscriptOnly({
      spaceSlug,
      callSessionId,
      transcriptText,
    });
    if (!transcriptResult.ok) {
      return NextResponse.json(
        { error: transcriptResult.error },
        { status: 400 },
      );
    }
    try {
      await enqueueSignalEvaluationFromMemory(
        {
          spaceSlug,
          triggerKind: 'memory_ingest',
        },
        { db },
      );
    } catch (error) {
      console.error('[matrix.call-artifacts.upload] enqueue failed', {
        spaceSlug,
        triggerKind: 'memory_ingest',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    logCallArtifactsUpload('transcript_only_ingested', {
      spaceSlug,
      roomId,
      callSessionId,
    });
    await trackIngestState({
      spaceId: space.id,
      callSessionId,
      state: 'ingested',
      transcriptStored: true,
      metadata: {
        mode: 'transcript_only',
      },
    });
    return NextResponse.json({
      ok: true,
      media_uri: null,
      call_session_id: callSessionId,
      recording_stored: false,
      transcript_stored: true,
      transcript_job: {
        attempted: false,
        ok: false,
        status: null,
      },
    });
  }

  const environment = determineEnvironment(request.url);
  const matrix = await resolveMatrixAccessToken(environment, privyUserId);
  if (!matrix) {
    if (transcriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        try {
          await enqueueSignalEvaluationFromMemory(
            {
              spaceSlug,
              triggerKind: 'memory_ingest',
            },
            { db },
          );
        } catch (error) {
          console.error('[matrix.call-artifacts.upload] enqueue failed', {
            spaceSlug,
            triggerKind: 'memory_ingest',
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return NextResponse.json({
          ok: true,
          media_uri: null,
          call_session_id: callSessionId,
          recording_stored: false,
          transcript_stored: true,
          warning: 'Recording upload skipped: unable to resolve Matrix token',
          transcript_job: {
            attempted: false,
            ok: false,
            status: null,
          },
        });
      }
    }
    logCallArtifactsUpload('matrix_token_unavailable', {
      spaceSlug,
      roomId,
      callSessionId,
      hasTranscriptText: Boolean(transcriptText),
    });
    await trackIngestState({
      spaceId: space.id,
      callSessionId,
      state: 'retry_pending',
      incrementAttempts: true,
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastError: 'Unable to resolve Matrix token',
      transcriptStored: Boolean(transcriptText),
      metadata: {
        fallbackTranscript: Boolean(transcriptText),
      },
    });
    return NextResponse.json(
      { error: 'Unable to resolve Matrix token' },
      { status: 403 },
    );
  }

  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  if (!homeserver) {
    return NextResponse.json(
      { error: 'Matrix homeserver not configured' },
      { status: 500 },
    );
  }

  const recordingBlob = recording as Blob;
  await trackIngestState({
    spaceId: space.id,
    callSessionId,
    state: 'uploading',
    incrementAttempts: true,
    metadata: {
      recordingBytes: recordingBlob.size,
      mimeType,
    },
  });
  const buffer = Buffer.from(await recordingBlob.arrayBuffer());
  const uploadUrl = `${homeserver}/_matrix/media/v3/upload?filename=${encodeURIComponent(
    `${callSessionId}.webm`,
  )}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${matrix.accessToken}`,
      'Content-Type': mimeType,
      'Content-Length': String(buffer.byteLength),
    },
    body: buffer,
    signal: AbortSignal.timeout(45_000),
  }).catch((error) => error);

  if (uploadResponse instanceof Error) {
    if (transcriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        logCallArtifactsUpload('recording_upload_error_transcript_fallback', {
          spaceSlug,
          roomId,
          callSessionId,
          error: uploadResponse.message,
        });
        return NextResponse.json({
          ok: true,
          media_uri: null,
          call_session_id: callSessionId,
          recording_stored: false,
          transcript_stored: true,
          warning: `Recording upload skipped: ${uploadResponse.message}`,
          transcript_job: {
            attempted: false,
            ok: false,
            status: null,
          },
        });
      }
    }
    await trackIngestState({
      spaceId: space.id,
      callSessionId,
      state: 'retry_pending',
      nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      lastError: uploadResponse.message,
      transcriptStored: Boolean(transcriptText),
      metadata: {
        uploadStage: 'network_error',
      },
    });
    return NextResponse.json(
      { error: `Matrix upload failed: ${uploadResponse.message}` },
      { status: 502 },
    );
  }
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => '');
    if (transcriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        logCallArtifactsUpload('recording_upload_http_transcript_fallback', {
          spaceSlug,
          roomId,
          callSessionId,
          status: uploadResponse.status,
        });
        return NextResponse.json({
          ok: true,
          media_uri: null,
          call_session_id: callSessionId,
          recording_stored: false,
          transcript_stored: true,
          warning: `Recording upload skipped (${uploadResponse.status}) ${detail}`,
          transcript_job: {
            attempted: false,
            ok: false,
            status: null,
          },
        });
      }
    }
    await trackIngestState({
      spaceId: space.id,
      callSessionId,
      state: 'retry_pending',
      nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      lastError: `Matrix upload failed (${uploadResponse.status}) ${detail}`,
      transcriptStored: Boolean(transcriptText),
      metadata: {
        uploadStage: 'http_error',
        uploadStatus: uploadResponse.status,
      },
    });
    return NextResponse.json(
      { error: `Matrix upload failed (${uploadResponse.status}) ${detail}` },
      { status: 502 },
    );
  }
  const uploadPayload =
    ((await uploadResponse
      .json()
      .catch(() => null)) as MatrixMediaUploadResponse | null) ?? null;
  const mediaUri = uploadPayload?.content_uri?.trim();
  if (!mediaUri) {
    if (transcriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        logCallArtifactsUpload('recording_upload_no_uri_transcript_fallback', {
          spaceSlug,
          roomId,
          callSessionId,
        });
        return NextResponse.json({
          ok: true,
          media_uri: null,
          call_session_id: callSessionId,
          recording_stored: false,
          transcript_stored: true,
          warning:
            'Recording upload skipped: Matrix did not return content_uri',
          transcript_job: {
            attempted: false,
            ok: false,
            status: null,
          },
        });
      }
    }
    await trackIngestState({
      spaceId: space.id,
      callSessionId,
      state: 'retry_pending',
      nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      lastError: 'Matrix upload did not return content_uri',
      transcriptStored: Boolean(transcriptText),
      metadata: {
        uploadStage: 'missing_uri',
      },
    });
    return NextResponse.json(
      { error: 'Matrix upload did not return content_uri' },
      { status: 502 },
    );
  }

  const ingestResult = await ingestSpaceCallArtifacts(
    {
      spaceSlug,
      callSessionId,
      recording: {
        mediaUri,
        mimeType,
        startedAt: startedAt || undefined,
        endedAt: endedAt || undefined,
        source: 'matrix_live_call_upload',
      },
      transcript: transcriptText
        ? {
            text: transcriptText,
            source: 'browser_speech_recognition',
            metadata: {
              capture: 'automatic_in_call',
            },
          }
        : undefined,
    },
    { db },
  );

  if (!ingestResult.ok) {
    logCallArtifactsUpload('ingest_failed', {
      spaceSlug,
      roomId,
      callSessionId,
      error: ingestResult.error,
    });
    await trackIngestState({
      spaceId: space.id,
      callSessionId,
      state: 'failed',
      lastError: ingestResult.error,
      recordingStored: true,
      transcriptStored: Boolean(transcriptText),
    });
    return NextResponse.json({ error: ingestResult.error }, { status: 400 });
  }

  try {
    await enqueueSignalEvaluationFromMemory(
      {
        spaceSlug,
        triggerKind: 'memory_ingest',
      },
      { db },
    );
  } catch (error) {
    console.error('[matrix.call-artifacts.upload] enqueue failed', {
      spaceSlug,
      triggerKind: 'memory_ingest',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const transcriptJob = await triggerTranscriptJob({
    spaceSlug,
    roomId,
    callSessionId,
    mediaUri,
    mimeType,
    startedAt: startedAt || undefined,
    endedAt: endedAt || undefined,
  }).catch(() => ({ attempted: true as const, ok: false as const, status: 0 }));
  logCallArtifactsUpload('recording_and_transcript_ingested', {
    spaceSlug,
    roomId,
    callSessionId,
    transcriptStored: Boolean(transcriptText),
    transcriptJobAttempted: transcriptJob.attempted,
    transcriptJobOk: transcriptJob.ok,
    transcriptJobStatus: transcriptJob.status,
  });
  await trackIngestState({
    spaceId: space.id,
    callSessionId,
    state: 'ingested',
    recordingStored: true,
    transcriptStored: Boolean(transcriptText),
    metadata: {
      transcriptJobAttempted: transcriptJob.attempted,
      transcriptJobOk: transcriptJob.ok,
      transcriptJobStatus: transcriptJob.status,
    },
  });
  return NextResponse.json({
    ok: true,
    media_uri: mediaUri,
    call_session_id: callSessionId,
    recording_stored: true,
    transcript_stored: Boolean(transcriptText),
    transcript_job: {
      attempted: transcriptJob.attempted,
      ok: transcriptJob.ok,
      status: transcriptJob.status,
    },
  });
}
