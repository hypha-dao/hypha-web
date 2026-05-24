import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import { coherences, db, spaces } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  computeCallRecordingDurationSeconds,
  determineEnvironment,
  enqueueSignalEvaluationFromMemory,
  findSpaceHostFieldsBySlug,
  getSpaceCallRecordingBySessionId,
  ingestSpaceCallArtifacts,
  isTrustedCallRecordingMediaUrl,
  objectStorageUriMatchesKey,
  verifyCallRecordingMediaAccessible,
} from '@hypha-platform/core/server';
import {
  resolveMatrixAccessToken,
  verifyMatrixMediaUriAccessible,
  verifyPrivyToken,
} from '../../room-call-permissions/_lib';

function normalizeTranscriptForIngest(text: string | undefined): string | null {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return null;
  if (
    trimmed === '[No speech captured during this call. Capture session saved.]'
  ) {
    return null;
  }
  return trimmed;
}

function readCallLaunchMetadata(
  form: FormData | null,
): Record<string, unknown> {
  const signalTitle = String(form?.get('signal_title') ?? '').trim();
  const contextTitle = String(form?.get('context_title') ?? '').trim();
  const signalSlug = String(form?.get('signal_slug') ?? '').trim();
  const threadRootEventId = String(
    form?.get('thread_root_event_id') ?? '',
  ).trim();
  const metadata: Record<string, unknown> = {
    capture: 'automatic_in_call',
  };
  if (signalTitle) metadata.signal_title = signalTitle;
  if (contextTitle) metadata.context_title = contextTitle;
  if (signalSlug) metadata.signal_slug = signalSlug;
  if (threadRootEventId) metadata.thread_root_event_id = threadRootEventId;
  return metadata;
}

async function resolveMatrixUploadContext(
  request: NextRequest,
  privyUserId: string,
): Promise<
  | { ok: true; accessToken: string; homeserverUrl: string }
  | { ok: false; status: number; error: string }
> {
  const environment = determineEnvironment(request.url);
  const matrix = await resolveMatrixAccessToken(environment, privyUserId);
  if (!matrix) {
    return {
      ok: false,
      status: 403,
      error: 'Unable to resolve Matrix token',
    };
  }
  const homeserverUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  if (!homeserverUrl) {
    return {
      ok: false,
      status: 500,
      error: 'Matrix homeserver not configured',
    };
  }
  return { ok: true, accessToken: matrix.accessToken, homeserverUrl };
}

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
  metadata?: Record<string, unknown>;
}) {
  const { spaceSlug, callSessionId } = params;
  const normalizedText = normalizeTranscriptForIngest(params.transcriptText);
  if (!normalizedText) {
    return { ok: false, error: 'transcript.text is required' };
  }
  const transcriptResult = await ingestSpaceCallArtifacts(
    {
      spaceSlug,
      callSessionId,
      transcript: {
        text: normalizedText,
        source: 'browser_speech_recognition',
        metadata: params.metadata ?? {
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
  const launchMetadata = readCallLaunchMetadata(form);
  const roomId = String(form?.get('room_id') ?? '').trim();
  const callSessionId =
    String(form?.get('call_session_id') ?? '').trim() || randomUUID();
  const recording = form?.get('recording');
  const transcriptText = String(form?.get('transcript_text') ?? '').trim();
  const normalizedTranscriptText = normalizeTranscriptForIngest(transcriptText);
  const mimeType = String(form?.get('mime_type') ?? '').trim() || 'video/webm';
  const startedAt = String(form?.get('started_at') ?? '').trim();
  const endedAt = String(form?.get('ended_at') ?? '').trim();
  const clientMediaUri = String(form?.get('media_uri') ?? '').trim();
  const storageKey = String(form?.get('storage_key') ?? '').trim();
  const hasClientMxcUri = clientMediaUri.startsWith('mxc://');
  const hasClientObjectStorageUri =
    isTrustedCallRecordingMediaUrl(clientMediaUri);
  const hasClientMediaUri = hasClientMxcUri || hasClientObjectStorageUri;
  const hasRecordingBlob = recording instanceof Blob && recording.size > 0;
  logCallArtifactsUpload('request_received', {
    spaceSlug,
    roomId,
    callSessionId,
    hasRecordingBlob,
    hasClientMxcUri,
    hasClientObjectStorageUri,
    hasTranscriptText: Boolean(normalizedTranscriptText),
  });

  if (
    !roomId ||
    (!hasRecordingBlob && !hasClientMediaUri && !normalizedTranscriptText)
  ) {
    return NextResponse.json(
      {
        error:
          'room_id and either object-storage media_uri, legacy mxc media_uri, or transcript_text are required',
      },
      { status: 400 },
    );
  }
  if (hasRecordingBlob) {
    return NextResponse.json(
      {
        error:
          'Raw recording blobs are no longer accepted. Upload to object storage first and send media_uri with storage_key.',
      },
      { status: 400 },
    );
  }
  if (hasClientObjectStorageUri && clientMediaUri.length > 0 && !storageKey) {
    return NextResponse.json(
      { error: 'storage_key is required with object storage media_uri' },
      { status: 400 },
    );
  }
  if (
    hasClientObjectStorageUri &&
    storageKey &&
    !objectStorageUriMatchesKey(clientMediaUri, storageKey)
  ) {
    return NextResponse.json(
      { error: 'storage_key does not match media_uri' },
      { status: 400 },
    );
  }
  if (
    clientMediaUri.length > 0 &&
    !hasClientMxcUri &&
    !hasClientObjectStorageUri
  ) {
    return NextResponse.json(
      { error: 'media_uri must be mxc:// or a trusted object storage URL' },
      { status: 400 },
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
    logCallArtifactsUpload('space_room_mismatch_rejected', {
      spaceSlug,
      resolvedSpaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      spaceChatRoomId: space.chatRoomId,
    });
    return NextResponse.json(
      { error: 'room_id is not linked to this space' },
      { status: 403 },
    );
  }

  const existingRecording = await getSpaceCallRecordingBySessionId(
    { spaceId: space.id, callSessionId },
    { db },
  );
  if (existingRecording?.mediaUri?.trim()) {
    if (normalizedTranscriptText) {
      const transcriptResult = await persistTranscriptOnly({
        spaceSlug: targetSpaceSlug,
        callSessionId,
        transcriptText: normalizedTranscriptText,
        metadata: launchMetadata,
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
      transcriptStored: Boolean(normalizedTranscriptText),
    });
    return NextResponse.json({
      ok: true,
      media_uri: existingRecording.mediaUri,
      call_session_id: callSessionId,
      recording_stored: true,
      transcript_stored: Boolean(normalizedTranscriptText),
      transcript_job: {
        attempted: false,
        ok: false,
        status: null,
      },
      deduped: true,
    });
  }

  if (!hasRecordingBlob && hasClientObjectStorageUri) {
    const mediaAccessible = await verifyCallRecordingMediaAccessible(
      clientMediaUri,
    );
    if (!mediaAccessible) {
      logCallArtifactsUpload('object_storage_media_uri_not_accessible', {
        spaceSlug,
        roomId,
        callSessionId,
      });
      return NextResponse.json(
        {
          error:
            'media_uri is not accessible. Finish the object storage upload before ingesting.',
        },
        { status: 400 },
      );
    }
    const durationSeconds = computeCallRecordingDurationSeconds(
      startedAt || undefined,
      endedAt || undefined,
    );
    const ingestResult = await ingestSpaceCallArtifacts(
      {
        spaceSlug: targetSpaceSlug,
        callSessionId,
        recording: {
          mediaUri: clientMediaUri,
          storageKey,
          mimeType,
          durationSeconds: durationSeconds ?? undefined,
          startedAt: startedAt || undefined,
          endedAt: endedAt || undefined,
          source: 'client_object_storage_upload',
          metadata: launchMetadata,
        },
        transcript: normalizedTranscriptText
          ? {
              text: normalizedTranscriptText,
              source: 'browser_speech_recognition',
              metadata: launchMetadata,
            }
          : undefined,
      },
      { db },
    );
    if (!ingestResult.ok) {
      logCallArtifactsUpload('object_storage_ingest_failed', {
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
        triggerKind: 'memory_ingest',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const transcriptJob = await triggerTranscriptJob({
      spaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      mediaUri: clientMediaUri,
      mimeType,
      startedAt: startedAt || undefined,
      endedAt: endedAt || undefined,
    });
    logCallArtifactsUpload('object_storage_ingested', {
      spaceSlug,
      resolvedSpaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      transcriptStored: Boolean(normalizedTranscriptText),
    });
    return NextResponse.json({
      ok: true,
      media_uri: clientMediaUri,
      call_session_id: callSessionId,
      recording_stored: true,
      transcript_stored: Boolean(normalizedTranscriptText),
      transcript_job: transcriptJob,
    });
  }

  if (!hasRecordingBlob && hasClientMxcUri) {
    const matrixContext = await resolveMatrixUploadContext(
      request,
      privyUserId,
    );
    if (!matrixContext.ok) {
      return NextResponse.json(
        { error: matrixContext.error },
        { status: matrixContext.status },
      );
    }
    const mediaAccessible = await verifyMatrixMediaUriAccessible({
      mediaUri: clientMediaUri,
      accessToken: matrixContext.accessToken,
      homeserverUrl: matrixContext.homeserverUrl,
    });
    if (!mediaAccessible) {
      logCallArtifactsUpload('client_media_uri_not_accessible', {
        spaceSlug,
        roomId,
        callSessionId,
      });
      return NextResponse.json(
        {
          error:
            'media_uri is not accessible with your Matrix credentials. Upload the recording through the client first.',
        },
        { status: 400 },
      );
    }
    const ingestResult = await ingestSpaceCallArtifacts(
      {
        spaceSlug: targetSpaceSlug,
        callSessionId,
        recording: {
          mediaUri: clientMediaUri,
          mimeType,
          startedAt: startedAt || undefined,
          endedAt: endedAt || undefined,
          source: 'matrix_live_call_upload',
          metadata: launchMetadata,
        },
        transcript: normalizedTranscriptText
          ? {
              text: normalizedTranscriptText,
              source: 'browser_speech_recognition',
              metadata: launchMetadata,
            }
          : undefined,
      },
      { db },
    );
    if (!ingestResult.ok) {
      logCallArtifactsUpload('client_media_uri_ingest_failed', {
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
        triggerKind: 'memory_ingest',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const transcriptJob = await triggerTranscriptJob({
      spaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      mediaUri: clientMediaUri,
      mimeType,
      startedAt: startedAt || undefined,
      endedAt: endedAt || undefined,
    });
    logCallArtifactsUpload('client_media_uri_ingested', {
      spaceSlug,
      resolvedSpaceSlug: targetSpaceSlug,
      roomId,
      callSessionId,
      transcriptStored: Boolean(normalizedTranscriptText),
    });
    return NextResponse.json({
      ok: true,
      media_uri: clientMediaUri,
      call_session_id: callSessionId,
      recording_stored: true,
      transcript_stored: Boolean(normalizedTranscriptText),
      transcript_job: transcriptJob,
    });
  }

  if (!hasRecordingBlob) {
    const transcriptResult = await persistTranscriptOnly({
      spaceSlug: targetSpaceSlug,
      callSessionId,
      transcriptText,
      metadata: launchMetadata,
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

  return NextResponse.json(
    { error: 'Unsupported call artifact upload' },
    { status: 400 },
  );
}
