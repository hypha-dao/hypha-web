import 'server-only';

import { and, desc, eq, isNull, lte, lt, or, sql } from 'drizzle-orm';
import {
  coherences,
  spaceCallArtifactIngestRuns,
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';

export type IngestSpaceCallArtifactsInput = {
  spaceSlug: string;
  callSessionId: string;
  recording?: {
    mediaUri: string;
    mimeType?: string;
    durationSeconds?: number;
    startedAt?: string;
    endedAt?: string;
    storageKey?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  };
  transcript?: {
    language?: string;
    text: string;
    summary?: string;
    source?: string;
    segments?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  };
};

export type SpaceCallArtifactIngestResult =
  | { ok: true; spaceId: number; callSessionId: string }
  | { ok: false; error: string };

type SpaceCallRecordingRow = typeof spaceCallRecordings.$inferSelect;
type SpaceCallTranscriptRow = typeof spaceCallTranscripts.$inferSelect;
type SpaceDiscussionSummaryRow = typeof spaceDiscussionSummaries.$inferSelect;
type SpaceCallArtifactIngestRunRow =
  typeof spaceCallArtifactIngestRuns.$inferSelect;

export type SpaceCallArtifactIngestState =
  | 'pending'
  | 'uploading'
  | 'ingested'
  | 'failed'
  | 'retry_pending';

type MatrixTimelineEvent = {
  type?: string;
  sender?: string;
  content?: Record<string, unknown>;
  origin_server_ts?: number;
};

function summarizeTranscriptText(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  if (compact.length <= 320) return compact;
  const cut = compact.slice(0, 320);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '));
  return (stop > 120 ? cut.slice(0, stop + 1) : `${cut}...`).trim();
}

function normalizeRecordingMediaUri(value: string): string | null {
  const mediaUri = value.trim();
  if (!mediaUri) return null;
  if (mediaUri.startsWith('mxc://')) return mediaUri;
  try {
    const parsed = new URL(mediaUri);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function ingestSpaceCallArtifacts(
  input: IngestSpaceCallArtifactsInput,
  { db }: DbConfig,
): Promise<SpaceCallArtifactIngestResult> {
  const spaceSlug = input.spaceSlug.trim();
  const callSessionId = input.callSessionId.trim();
  if (!spaceSlug || !callSessionId) {
    return { ok: false, error: 'spaceSlug and callSessionId are required' };
  }
  if (!input.recording && !input.transcript) {
    return {
      ok: false,
      error: 'At least one of recording or transcript must be provided',
    };
  }

  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return { ok: false, error: 'Space not found' };

  const transcriptText = input.transcript?.text.trim();
  if (input.transcript && !transcriptText) {
    return { ok: false, error: 'transcript.text is required' };
  }

  const recordingMediaUri = input.recording
    ? normalizeRecordingMediaUri(input.recording.mediaUri)
    : null;
  if (input.recording && !recordingMediaUri) {
    return {
      ok: false,
      error: 'recording.mediaUri must be an mxc:// URI or https URL',
    };
  }

  await db.transaction(async (tx) => {
    if (input.recording && recordingMediaUri) {
      await tx
        .insert(spaceCallRecordings)
        .values({
          spaceId: host.id,
          callSessionId,
          mediaUri: recordingMediaUri,
          storageKey: input.recording.storageKey?.trim() || null,
          mimeType: input.recording.mimeType?.trim() || 'video/webm',
          durationSeconds: input.recording.durationSeconds ?? null,
          startedAt: input.recording.startedAt?.trim() || null,
          endedAt: input.recording.endedAt?.trim() || null,
          source: input.recording.source?.trim() || 'ingest',
          metadata: input.recording.metadata ?? {},
        })
        .onConflictDoUpdate({
          target: [
            spaceCallRecordings.spaceId,
            spaceCallRecordings.callSessionId,
          ],
          set: {
            mediaUri: recordingMediaUri,
            storageKey: input.recording.storageKey?.trim() || null,
            mimeType: input.recording.mimeType?.trim() || 'video/webm',
            durationSeconds: input.recording.durationSeconds ?? null,
            startedAt: input.recording.startedAt?.trim() || null,
            endedAt: input.recording.endedAt?.trim() || null,
            source: input.recording.source?.trim() || 'ingest',
            metadata: input.recording.metadata ?? {},
            updatedAt: new Date(),
          },
        });
    }

    if (input.transcript && transcriptText) {
      await tx
        .insert(spaceCallTranscripts)
        .values({
          spaceId: host.id,
          callSessionId,
          language: input.transcript.language?.trim() || 'und',
          text: transcriptText,
          summary:
            input.transcript.summary?.trim() ||
            summarizeTranscriptText(transcriptText),
          source: input.transcript.source?.trim() || 'stt',
          segments: input.transcript.segments ?? [],
          metadata: input.transcript.metadata ?? {},
        })
        .onConflictDoUpdate({
          target: [
            spaceCallTranscripts.spaceId,
            spaceCallTranscripts.callSessionId,
          ],
          set: {
            language: input.transcript.language?.trim() || 'und',
            text: transcriptText,
            summary:
              input.transcript.summary?.trim() ||
              summarizeTranscriptText(transcriptText),
            source: input.transcript.source?.trim() || 'stt',
            segments: input.transcript.segments ?? [],
            metadata: input.transcript.metadata ?? {},
            updatedAt: new Date(),
          },
        });
    }
  });

  return { ok: true, spaceId: host.id, callSessionId };
}

function extractPlainMessageText(content: Record<string, unknown> | undefined) {
  if (!content) return null;
  const msgtype = content.msgtype;
  if (msgtype !== 'm.text' && msgtype !== 'm.notice') return null;
  const body = content.body;
  if (typeof body !== 'string') return null;
  const cleaned = body.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function summarizeDiscussion(messages: string[]): {
  summary: string;
  bullets: string[];
} {
  if (messages.length === 0) {
    return { summary: 'No discussion messages found.', bullets: [] };
  }
  const bullets = messages
    .slice(-3)
    .map((m) => (m.length > 220 ? `${m.slice(0, 217).trim()}...` : m));
  const joined = messages.join(' ');
  const summary = summarizeTranscriptText(joined);
  return { summary, bullets };
}

type MatrixChunkResponse = {
  chunk?: MatrixTimelineEvent[];
  end?: string;
};

function createTimeoutSignal(
  timeoutMs: number,
  parentSignal?: AbortSignal,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Matrix request timed out'));
  }, timeoutMs);

  const onParentAbort = () => {
    controller.abort(parentSignal?.reason);
  };
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timeoutId);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    },
  };
}

async function resolveMatrixAccessToken(
  authToken: string | undefined,
  requestUrlForSessionMatrix: string | undefined,
) {
  const botToken = process.env.HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN?.trim();
  if (botToken) return botToken;
  const sessionAuth = authToken?.trim();
  const sessionReqUrl = requestUrlForSessionMatrix?.trim();
  if (!sessionAuth || !sessionReqUrl) return null;
  const { resolveUserMatrixAccessTokenForOrgMemory } = await import(
    './resolve-user-matrix-access-token-for-org-memory'
  );
  return (
    (await resolveUserMatrixAccessTokenForOrgMemory(
      sessionAuth,
      sessionReqUrl,
    )) ?? null
  );
}

async function fetchRoomDiscussionMessages(
  roomId: string,
  authToken: string | undefined,
  requestUrlForSessionMatrix: string | undefined,
  signal?: AbortSignal,
  maxPages = 5,
): Promise<{ messages: string[]; participantIds: string[] }> {
  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  if (!homeserver) return { messages: [], participantIds: [] };
  const accessToken = await resolveMatrixAccessToken(
    authToken,
    requestUrlForSessionMatrix,
  );
  if (!accessToken) return { messages: [], participantIds: [] };

  const senders = new Set<string>();
  const messages: string[] = [];
  let fromToken: string | undefined;

  for (let i = 0; i < maxPages; i++) {
    if (signal?.aborted) {
      throw new Error(
        signal.reason instanceof Error
          ? signal.reason.message
          : 'Summary generation aborted',
      );
    }
    const params = new URLSearchParams({ dir: 'b', limit: '100' });
    if (fromToken) params.set('from', fromToken);
    const url = `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/messages?${params.toString()}`;
    const requestSignal = createTimeoutSignal(15_000, signal);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: requestSignal.signal,
    }).finally(requestSignal.clear);
    if (res.status === 401) {
      console.warn(
        '[call-artifacts] Matrix 401 on Bearer auth; skipping query-param token fallback',
      );
      break;
    }
    if (!res.ok) break;
    let body: MatrixChunkResponse;
    try {
      const parsed = await res.json();
      if (!parsed || typeof parsed !== 'object') {
        console.warn(
          '[call-artifacts] Matrix returned malformed payload shape',
        );
        break;
      }
      body = parsed as MatrixChunkResponse;
    } catch {
      console.warn('[call-artifacts] Matrix returned non-JSON response');
      break;
    }
    const chunk = Array.isArray(body.chunk) ? body.chunk : [];
    for (const ev of chunk) {
      if (ev.sender) senders.add(ev.sender);
      const text = extractPlainMessageText(ev.content);
      if (text) messages.push(text);
    }
    const next = typeof body.end === 'string' ? body.end : undefined;
    if (!next || chunk.length === 0) break;
    fromToken = next;
  }

  return { messages: messages.reverse(), participantIds: [...senders] };
}

async function listSpaceDiscussionRoomIds(
  spaceId: number,
  primaryRoomId: string,
  { db }: DbConfig,
): Promise<string[]> {
  const coherenceRows = await db
    .select({ roomId: coherences.roomId })
    .from(coherences)
    .where(and(eq(coherences.spaceId, spaceId), eq(coherences.archived, false)))
    .orderBy(desc(coherences.updatedAt))
    .limit(200);

  const seen = new Set<string>();
  const roomIds: string[] = [];
  const pushUnique = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    roomIds.push(trimmed);
  };

  pushUnique(primaryRoomId);
  for (const row of coherenceRows) {
    pushUnique(row.roomId);
  }
  return roomIds;
}

export async function createSpaceDiscussionSummary(
  {
    spaceSlug,
    source = 'heuristic',
    authToken,
    requestUrlForSessionMatrix,
    signal,
  }: {
    spaceSlug: string;
    source?: string;
    authToken?: string;
    requestUrlForSessionMatrix?: string;
    signal?: AbortSignal;
  },
  { db }: DbConfig,
): Promise<
  | {
      ok: true;
      summaryId: number;
      messageCount: number;
      participantCount: number;
    }
  | { ok: false; error: string }
> {
  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return { ok: false, error: 'Space not found' };
  const primaryRoomId = host.chatRoomId?.trim();
  if (!primaryRoomId) return { ok: false, error: 'Space has no chat room' };
  const roomIds = await listSpaceDiscussionRoomIds(host.id, primaryRoomId, {
    db,
  });
  if (roomIds.length === 0) {
    return { ok: false, error: 'No eligible discussion rooms found' };
  }

  const allMessages: string[] = [];
  const participantIds = new Set<string>();
  for (const roomId of roomIds) {
    const result = await fetchRoomDiscussionMessages(
      roomId,
      authToken,
      requestUrlForSessionMatrix,
      signal,
    );
    for (const participantId of result.participantIds) {
      if (participantId.trim()) participantIds.add(participantId.trim());
    }
    if (result.messages.length > 0) {
      allMessages.push(...result.messages);
    }
  }

  const messages = allMessages;
  const participantCount = participantIds.size;
  if (messages.length === 0) {
    return { ok: false, error: 'No chat messages available for summary' };
  }
  const { summary, bullets } = summarizeDiscussion(messages);
  // Intentionally append-only snapshots: each refresh preserves a point-in-time
  // summary instead of overwriting previous runs for the same room.
  const [inserted] = await db
    .insert(spaceDiscussionSummaries)
    .values({
      spaceId: host.id,
      matrixRoomId: primaryRoomId,
      summary,
      bullets,
      messageCount: messages.length,
      participantCount,
      source,
      metadata: {
        includedRoomIds: roomIds,
      },
      windowStart: null,
      windowEnd: null,
    })
    .returning();

  if (!inserted) return { ok: false, error: 'Failed to persist summary' };
  return {
    ok: true,
    summaryId: inserted.id,
    messageCount: messages.length,
    participantCount,
  };
}

export async function listSpaceCallArtifactsBySpaceId(
  spaceId: number,
  { db }: DbConfig,
): Promise<{
  recordings: SpaceCallRecordingRow[];
  transcripts: SpaceCallTranscriptRow[];
  summaries: SpaceDiscussionSummaryRow[];
}> {
  const [recordings, transcripts, summaries] = await Promise.all([
    db
      .select()
      .from(spaceCallRecordings)
      .where(eq(spaceCallRecordings.spaceId, spaceId))
      .orderBy(desc(spaceCallRecordings.createdAt))
      .limit(25),
    db
      .select()
      .from(spaceCallTranscripts)
      .where(eq(spaceCallTranscripts.spaceId, spaceId))
      .orderBy(desc(spaceCallTranscripts.createdAt))
      .limit(25),
    db
      .select()
      .from(spaceDiscussionSummaries)
      .where(eq(spaceDiscussionSummaries.spaceId, spaceId))
      .orderBy(desc(spaceDiscussionSummaries.createdAt))
      .limit(25),
  ]);
  return { recordings, transcripts, summaries };
}

export async function getSpaceCallRecordingBySessionId(
  {
    spaceId,
    callSessionId,
  }: {
    spaceId: number;
    callSessionId: string;
  },
  { db }: DbConfig,
): Promise<SpaceCallRecordingRow | null> {
  const [row] = await db
    .select()
    .from(spaceCallRecordings)
    .where(
      and(
        eq(spaceCallRecordings.spaceId, spaceId),
        eq(spaceCallRecordings.callSessionId, callSessionId.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getSpaceCallTranscriptBySessionId(
  {
    spaceId,
    callSessionId,
  }: {
    spaceId: number;
    callSessionId: string;
  },
  { db }: DbConfig,
): Promise<SpaceCallTranscriptRow | null> {
  const [row] = await db
    .select()
    .from(spaceCallTranscripts)
    .where(
      and(
        eq(spaceCallTranscripts.spaceId, spaceId),
        eq(spaceCallTranscripts.callSessionId, callSessionId.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getSpaceCallArtifactById(
  {
    kind,
    id,
    spaceId,
  }: {
    kind: 'recording' | 'transcript' | 'discussion_summary';
    id: number;
    spaceId: number;
  },
  { db }: DbConfig,
): Promise<
  | SpaceCallRecordingRow
  | SpaceCallTranscriptRow
  | SpaceDiscussionSummaryRow
  | null
> {
  if (kind === 'recording') {
    const [row] = await db
      .select()
      .from(spaceCallRecordings)
      .where(
        and(
          eq(spaceCallRecordings.id, id),
          eq(spaceCallRecordings.spaceId, spaceId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
  if (kind === 'transcript') {
    const [row] = await db
      .select()
      .from(spaceCallTranscripts)
      .where(
        and(
          eq(spaceCallTranscripts.id, id),
          eq(spaceCallTranscripts.spaceId, spaceId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select()
    .from(spaceDiscussionSummaries)
    .where(
      and(
        eq(spaceDiscussionSummaries.id, id),
        eq(spaceDiscussionSummaries.spaceId, spaceId),
      ),
    )
    .limit(1);
  return row ?? null;
}

function clampRetentionDays(
  value: number | undefined,
  fallback: number,
): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(3650, n));
}

export async function cleanupSpaceDiscussionSummariesRetention(
  {
    dryRun = true,
    retentionDays = 120,
  }: {
    dryRun?: boolean;
    retentionDays?: number;
  },
  { db }: DbConfig,
) {
  const effectiveRetentionDays = clampRetentionDays(retentionDays, 120);
  const cutoff = new Date(
    Date.now() - effectiveRetentionDays * 24 * 60 * 60 * 1000,
  );

  if (dryRun) {
    const [count] = await db
      .select({ count: sql<number>`count(*)` })
      .from(spaceDiscussionSummaries)
      .where(lt(spaceDiscussionSummaries.createdAt, cutoff));
    return {
      ok: true as const,
      dry_run: true,
      cutoff_before: cutoff.toISOString(),
      count: Number(count?.count ?? 0),
    };
  }

  const deleted = await db
    .delete(spaceDiscussionSummaries)
    .where(lt(spaceDiscussionSummaries.createdAt, cutoff))
    .returning();

  return {
    ok: true as const,
    dry_run: false,
    cutoff_before: cutoff.toISOString(),
    deleted: deleted.length,
  };
}

export async function recordSpaceCallArtifactIngestEvent(
  {
    spaceId,
    callSessionId,
    state,
    incrementAttempts = false,
    nextRetryAt,
    lastError,
    recordingStored,
    transcriptStored,
    metadata,
  }: {
    spaceId: number;
    callSessionId: string;
    state: SpaceCallArtifactIngestState;
    incrementAttempts?: boolean;
    nextRetryAt?: string | null;
    lastError?: string | null;
    recordingStored?: boolean;
    transcriptStored?: boolean;
    metadata?: Record<string, unknown>;
  },
  { db }: DbConfig,
): Promise<SpaceCallArtifactIngestRunRow> {
  const normalizedSession = callSessionId.trim();
  if (!normalizedSession) {
    throw new Error('callSessionId is required');
  }
  const existing = await db
    .select()
    .from(spaceCallArtifactIngestRuns)
    .where(
      and(
        eq(spaceCallArtifactIngestRuns.spaceId, spaceId),
        eq(spaceCallArtifactIngestRuns.callSessionId, normalizedSession),
      ),
    )
    .limit(1);
  const row = existing[0];
  const nextAttempts = incrementAttempts
    ? (row?.attempts ?? 0) + 1
    : (row?.attempts ?? 0);
  const nextRecordingStored = row
    ? row.recordingStored || Boolean(recordingStored)
    : Boolean(recordingStored);
  const nextTranscriptStored = row
    ? row.transcriptStored || Boolean(transcriptStored)
    : Boolean(transcriptStored);
  const nextMetadata = metadata ? { ...(row?.metadata ?? {}), ...metadata } : row?.metadata;

  if (!row) {
    const [inserted] = await db
      .insert(spaceCallArtifactIngestRuns)
      .values({
        spaceId,
        callSessionId: normalizedSession,
        state,
        attempts: nextAttempts,
        nextRetryAt: nextRetryAt ?? null,
        lastError: lastError ?? null,
        recordingStored: nextRecordingStored,
        transcriptStored: nextTranscriptStored,
        metadata: nextMetadata ?? {},
      })
      .returning();
    if (!inserted) {
      throw new Error('Failed to insert space call artifact ingest run');
    }
    return inserted;
  }

  const [updated] = await db
    .update(spaceCallArtifactIngestRuns)
    .set({
      state,
      attempts: nextAttempts,
      nextRetryAt: nextRetryAt ?? null,
      lastError: lastError ?? null,
      recordingStored: nextRecordingStored,
      transcriptStored: nextTranscriptStored,
      metadata: nextMetadata ?? {},
      updatedAt: new Date(),
    })
    .where(eq(spaceCallArtifactIngestRuns.id, row.id))
    .returning();
  if (!updated) {
    throw new Error('Failed to update space call artifact ingest run');
  }
  return updated;
}

export async function listSpaceCallArtifactIngestRunsForRetry(
  {
    spaceId,
    limit = 50,
  }: {
    spaceId?: number;
    limit?: number;
  },
  { db }: DbConfig,
): Promise<SpaceCallArtifactIngestRunRow[]> {
  const now = new Date();
  return db
    .select()
    .from(spaceCallArtifactIngestRuns)
    .where(
      and(
        spaceId ? eq(spaceCallArtifactIngestRuns.spaceId, spaceId) : undefined,
        or(
          eq(spaceCallArtifactIngestRuns.state, 'failed'),
          eq(spaceCallArtifactIngestRuns.state, 'retry_pending'),
        ),
        or(
          isNull(spaceCallArtifactIngestRuns.nextRetryAt),
          lte(spaceCallArtifactIngestRuns.nextRetryAt, now.toISOString()),
        ),
      ),
    )
    .orderBy(desc(spaceCallArtifactIngestRuns.updatedAt))
    .limit(Math.max(1, Math.min(500, limit)));
}

export async function cleanupSpaceCallArtifactsRetention(
  {
    dryRun = true,
    recordingRetentionDays = 365,
    transcriptRetentionDays = 365,
    ingestRunRetentionDays = 45,
  }: {
    dryRun?: boolean;
    recordingRetentionDays?: number;
    transcriptRetentionDays?: number;
    ingestRunRetentionDays?: number;
  },
  { db }: DbConfig,
) {
  const recordingsDays = clampRetentionDays(recordingRetentionDays, 365);
  const transcriptsDays = clampRetentionDays(transcriptRetentionDays, 365);
  const ingestDays = clampRetentionDays(ingestRunRetentionDays, 45);
  const recordingCutoff = new Date(Date.now() - recordingsDays * 24 * 60 * 60 * 1000);
  const transcriptCutoff = new Date(Date.now() - transcriptsDays * 24 * 60 * 60 * 1000);
  const ingestCutoff = new Date(Date.now() - ingestDays * 24 * 60 * 60 * 1000);

  if (dryRun) {
    const [recordingsCount, transcriptsCount, ingestRunsCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceCallRecordings)
        .where(lt(spaceCallRecordings.createdAt, recordingCutoff)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceCallTranscripts)
        .where(lt(spaceCallTranscripts.createdAt, transcriptCutoff)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceCallArtifactIngestRuns)
        .where(lt(spaceCallArtifactIngestRuns.createdAt, ingestCutoff)),
    ]);
    return {
      ok: true as const,
      dry_run: true,
      recording_cutoff_before: recordingCutoff.toISOString(),
      transcript_cutoff_before: transcriptCutoff.toISOString(),
      ingest_run_cutoff_before: ingestCutoff.toISOString(),
      recordings_count: Number(recordingsCount[0]?.count ?? 0),
      transcripts_count: Number(transcriptsCount[0]?.count ?? 0),
      ingest_runs_count: Number(ingestRunsCount[0]?.count ?? 0),
    };
  }

  const [deletedRecordings, deletedTranscripts, deletedIngestRuns] = await Promise.all([
    db
      .delete(spaceCallRecordings)
      .where(lt(spaceCallRecordings.createdAt, recordingCutoff))
      .returning({ id: spaceCallRecordings.id }),
    db
      .delete(spaceCallTranscripts)
      .where(lt(spaceCallTranscripts.createdAt, transcriptCutoff))
      .returning({ id: spaceCallTranscripts.id }),
    db
      .delete(spaceCallArtifactIngestRuns)
      .where(lt(spaceCallArtifactIngestRuns.createdAt, ingestCutoff))
      .returning({ id: spaceCallArtifactIngestRuns.id }),
  ]);

  return {
    ok: true as const,
    dry_run: false,
    recording_cutoff_before: recordingCutoff.toISOString(),
    transcript_cutoff_before: transcriptCutoff.toISOString(),
    ingest_run_cutoff_before: ingestCutoff.toISOString(),
    recordings_deleted: deletedRecordings.length,
    transcripts_deleted: deletedTranscripts.length,
    ingest_runs_deleted: deletedIngestRuns.length,
  };
}
