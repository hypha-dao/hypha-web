import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import {
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

  if (input.recording) {
    const mediaUri = input.recording.mediaUri.trim();
    if (!mediaUri)
      return { ok: false, error: 'recording.mediaUri is required' };
    await db
      .insert(spaceCallRecordings)
      .values({
        spaceId: host.id,
        callSessionId,
        mediaUri,
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
          mediaUri,
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

  if (input.transcript) {
    const transcriptText = input.transcript.text.trim();
    if (!transcriptText) {
      return { ok: false, error: 'transcript.text is required' };
    }
    await db
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
  maxPages = 5,
): Promise<{ messages: string[]; participantCount: number }> {
  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  if (!homeserver) return { messages: [], participantCount: 0 };
  const accessToken = await resolveMatrixAccessToken(
    authToken,
    requestUrlForSessionMatrix,
  );
  if (!accessToken) return { messages: [], participantCount: 0 };

  const senders = new Set<string>();
  const messages: string[] = [];
  let fromToken: string | undefined;

  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams({ dir: 'b', limit: '100' });
    if (fromToken) params.set('from', fromToken);
    let url = `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/messages?${params.toString()}`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      params.set('access_token', accessToken);
      url = `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
        roomId,
      )}/messages?${params.toString()}`;
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    }
    if (!res.ok) break;
    const body = (await res.json()) as MatrixChunkResponse;
    const chunk = body.chunk ?? [];
    for (const ev of chunk) {
      if (ev.sender) senders.add(ev.sender);
      const text = extractPlainMessageText(ev.content);
      if (text) messages.push(text);
    }
    const next = typeof body.end === 'string' ? body.end : undefined;
    if (!next || chunk.length === 0) break;
    fromToken = next;
  }

  return { messages: messages.reverse(), participantCount: senders.size };
}

export async function createSpaceDiscussionSummary(
  {
    spaceSlug,
    source = 'heuristic',
    authToken,
    requestUrlForSessionMatrix,
  }: {
    spaceSlug: string;
    source?: string;
    authToken?: string;
    requestUrlForSessionMatrix?: string;
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
  const roomId = host.chatRoomId?.trim();
  if (!roomId) return { ok: false, error: 'Space has no chat room' };

  const { messages, participantCount } = await fetchRoomDiscussionMessages(
    roomId,
    authToken,
    requestUrlForSessionMatrix,
  );
  if (messages.length === 0) {
    return { ok: false, error: 'No chat messages available for summary' };
  }
  const { summary, bullets } = summarizeDiscussion(messages);
  const [inserted] = await db
    .insert(spaceDiscussionSummaries)
    .values({
      spaceId: host.id,
      matrixRoomId: roomId,
      summary,
      bullets,
      messageCount: messages.length,
      participantCount,
      source,
      metadata: {},
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
) {
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
) {
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
