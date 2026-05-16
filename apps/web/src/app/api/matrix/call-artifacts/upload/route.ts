import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import { db } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  determineEnvironment,
  enqueueSignalEvaluationFromMemory,
  findSpaceHostFieldsBySlug,
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

  if (!roomId || !(recording instanceof Blob) || recording.size === 0) {
    return NextResponse.json(
      { error: 'room_id and non-empty recording blob are required' },
      { status: 400 },
    );
  }
  if (recording.size > MAX_RECORDING_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Recording exceeds max upload size (${MAX_RECORDING_UPLOAD_BYTES} bytes)`,
      },
      { status: 413 },
    );
  }

  const space = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (
    !space ||
    !space.chatRoomId?.trim() ||
    space.chatRoomId.trim() !== roomId
  ) {
    return NextResponse.json({ error: 'Space/room mismatch' }, { status: 404 });
  }

  const access = await checkSpaceAccessForSpace(space, authToken);
  if (!access.hasAccess) {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }

  const environment = determineEnvironment(request.url);
  const matrix = await resolveMatrixAccessToken(environment, privyUserId);
  if (!matrix) {
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

  const buffer = Buffer.from(await recording.arrayBuffer());
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
    return NextResponse.json(
      { error: `Matrix upload failed: ${uploadResponse.message}` },
      { status: 502 },
    );
  }
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => '');
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

  return NextResponse.json({
    ok: true,
    media_uri: mediaUri,
    call_session_id: callSessionId,
    transcript_stored: Boolean(transcriptText),
    transcript_job: {
      attempted: transcriptJob.attempted,
      ok: transcriptJob.ok,
      status: transcriptJob.status,
    },
  });
}
