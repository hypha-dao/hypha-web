import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import { coherences, db, spaces } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  determineEnvironment,
  enqueueSignalEvaluationFromMemory,
  findSpaceHostFieldsBySlug,
  getSpaceCallRecordingBySessionId,
  ingestSpaceCallArtifacts,
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

  let space = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!space && roomId) {
    const [fallbackSpace] = await db
      .select({
        id: spaces.id,
        slug: spaces.slug,
        title: spaces.title,
        parentId: spaces.parentId,
        web3SpaceId: spaces.web3SpaceId,
        chatRoomId: spaces.chatRoomId,
      })
      .from(spaces)
      .leftJoin(coherences, eq(coherences.spaceId, spaces.id))
      .where(or(eq(spaces.chatRoomId, roomId), eq(coherences.roomId, roomId)))
      .limit(1);
    if (fallbackSpace) {
      space = fallbackSpace;
      logCallArtifactsUpload('space_resolved_from_room', {
        requestedSpaceSlug: spaceSlug,
        resolvedSpaceSlug: fallbackSpace.slug,
        roomId,
        callSessionId,
      });
    }
  }
  if (!space) {
    logCallArtifactsUpload('space_not_found', {
      spaceSlug,
      roomId,
      callSessionId,
    });
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }
  const targetSpaceSlug = space.slug;

  const linkedRoom = await isSpaceLinkedCallRoom({
    spaceId: space.id,
    spaceChatRoomId: space.chatRoomId,
    roomId,
  });

  const access = await checkSpaceAccessForSpace(space, authToken);
  if (!access.hasAccess) {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }

  if (!linkedRoom) {
    // Do not block artifact ingestion when room linkage metadata is stale.
    // We still require an authenticated user with access to the target space.
    logCallArtifactsUpload('space_room_mismatch_bypassed', {
      spaceSlug,
      resolvedSpaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      spaceChatRoomId: space.chatRoomId,
    });
  }

  const existingRecording = await getSpaceCallRecordingBySessionId(
    { spaceId: space.id, callSessionId },
    { db },
  );
  if (existingRecording?.mediaUri?.trim()) {
    if (transcriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug: targetSpaceSlug,
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
      spaceSlug: targetSpaceSlug,
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
          spaceSlug: targetSpaceSlug,
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
      resolvedSpaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
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
        spaceSlug: targetSpaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        try {
          await enqueueSignalEvaluationFromMemory(
            {
              spaceSlug: targetSpaceSlug,
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
      resolvedSpaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      hasTranscriptText: Boolean(transcriptText),
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
        spaceSlug: targetSpaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        logCallArtifactsUpload('recording_upload_error_transcript_fallback', {
          spaceSlug,
          resolvedSpaceSlug: targetSpaceSlug,
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
    return NextResponse.json(
      { error: `Matrix upload failed: ${uploadResponse.message}` },
      { status: 502 },
    );
  }
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => '');
    if (transcriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug: targetSpaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        logCallArtifactsUpload('recording_upload_http_transcript_fallback', {
          spaceSlug,
          resolvedSpaceSlug: targetSpaceSlug,
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
        spaceSlug: targetSpaceSlug,
        callSessionId,
        transcriptText,
      });
      if (transcriptResult.ok) {
        logCallArtifactsUpload('recording_upload_no_uri_transcript_fallback', {
          spaceSlug,
          resolvedSpaceSlug: targetSpaceSlug,
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
    return NextResponse.json(
      { error: 'Matrix upload did not return content_uri' },
      { status: 502 },
    );
  }

  const ingestResult = await ingestSpaceCallArtifacts(
    {
      spaceSlug: targetSpaceSlug,
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
      resolvedSpaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      error: ingestResult.error,
    });
    return NextResponse.json({ error: ingestResult.error }, { status: 400 });
  }

  try {
    await enqueueSignalEvaluationFromMemory(
      {
        spaceSlug: targetSpaceSlug,
        triggerKind: 'memory_ingest',
      },
      { db },
    );
  } catch (error) {
    console.error('[matrix.call-artifacts.upload] enqueue failed', {
      spaceSlug,
      resolvedSpaceSlug: targetSpaceSlug,
      triggerKind: 'memory_ingest',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const transcriptJob = await triggerTranscriptJob({
    spaceSlug: targetSpaceSlug,
    roomId,
    callSessionId,
    mediaUri,
    mimeType,
    startedAt: startedAt || undefined,
    endedAt: endedAt || undefined,
  }).catch(() => ({ attempted: true as const, ok: false as const, status: 0 }));
  logCallArtifactsUpload('recording_and_transcript_ingested', {
    spaceSlug,
    resolvedSpaceSlug: targetSpaceSlug,
    roomId,
    callSessionId,
    transcriptStored: Boolean(transcriptText),
    transcriptJobAttempted: transcriptJob.attempted,
    transcriptJobOk: transcriptJob.ok,
    transcriptJobStatus: transcriptJob.status,
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
