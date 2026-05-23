import 'server-only';

import { and, desc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { spaces, threadSummaries } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import {
  generateThreadLivingSummaryWithLlm,
  type ThreadSummaryMessageLine,
} from './thread-summary-llm';

import {
  shouldRefreshThreadSummary,
  THREAD_SUMMARY_MATRIX_MAX_PAGES,
  THREAD_SUMMARY_MIN_MESSAGES,
  THREAD_SUMMARY_REFRESH_INTERVAL_MS,
} from './thread-summaries-gates';

export {
  shouldRefreshThreadSummary,
  THREAD_SUMMARY_MATRIX_MAX_PAGES,
  THREAD_SUMMARY_MIN_MESSAGES,
  THREAD_SUMMARY_REFRESH_INTERVAL_MS,
} from './thread-summaries-gates';

type MatrixTimelineEvent = {
  event_id?: string;
  type?: string;
  sender?: string;
  content?: Record<string, unknown>;
  origin_server_ts?: number;
};

type MatrixChunkResponse = {
  chunk?: MatrixTimelineEvent[];
  end?: string;
};

export type ThreadSummaryKind = 'space' | 'coherence';

export type ThreadSummaryView = {
  id: number;
  spaceId: number;
  matrixRoomId: string;
  threadKind: ThreadSummaryKind;
  coherenceSlug: string | null;
  threadTitle: string | null;
  summary: string;
  bullets: string[];
  messageCount: number;
  participantCount: number;
  updatedAt: string;
  lastRefreshedAt: string | null;
};

function extractPlainMessageText(
  content: Record<string, unknown> | undefined,
): string | null {
  if (!content) return null;
  const msgtype = content.msgtype;
  if (msgtype !== 'm.text' && msgtype !== 'm.notice') return null;
  const body = content.body;
  if (typeof body !== 'string') return null;
  const cleaned = body.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function senderLabel(sender: string | undefined): string {
  const value = sender?.trim();
  if (!value) return 'Someone';
  const local = value.split(':')[0]?.replace(/^@/, '');
  return local || value;
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

export async function fetchRoomThreadTimeline(
  roomId: string,
  authToken: string | undefined,
  requestUrlForSessionMatrix: string | undefined,
  signal?: AbortSignal,
  maxPages = THREAD_SUMMARY_MATRIX_MAX_PAGES,
): Promise<{
  lines: Array<{
    eventId: string;
    sender: string;
    text: string;
    originServerTs: number;
  }>;
  participantIds: string[];
}> {
  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  if (!homeserver) return { lines: [], participantIds: [] };
  const accessToken = await resolveMatrixAccessToken(
    authToken,
    requestUrlForSessionMatrix,
  );
  if (!accessToken) return { lines: [], participantIds: [] };

  const senders = new Set<string>();
  const lines: Array<{
    eventId: string;
    sender: string;
    text: string;
    originServerTs: number;
  }> = [];
  let fromToken: string | undefined;

  for (let i = 0; i < maxPages; i++) {
    if (signal?.aborted) {
      throw new Error('Thread summary fetch aborted');
    }
    const params = new URLSearchParams({ dir: 'b', limit: '100' });
    if (fromToken) params.set('from', fromToken);
    const url = `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/messages?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    if (!res.ok) break;
    const body = (await res.json()) as MatrixChunkResponse;
    const chunk = Array.isArray(body.chunk) ? body.chunk : [];
    for (const ev of chunk) {
      if (ev.type !== 'm.room.message') continue;
      const text = extractPlainMessageText(ev.content);
      if (!text) continue;
      if (ev.sender) senders.add(ev.sender);
      lines.push({
        eventId: ev.event_id?.trim() || `${ev.origin_server_ts ?? i}`,
        sender: senderLabel(ev.sender),
        text,
        originServerTs: ev.origin_server_ts ?? 0,
      });
    }
    const next = typeof body.end === 'string' ? body.end : undefined;
    if (!next || chunk.length === 0) break;
    fromToken = next;
  }

  return {
    lines: lines.reverse(),
    participantIds: [...senders],
  };
}

function rowToView(
  row: typeof threadSummaries.$inferSelect,
): ThreadSummaryView {
  return {
    id: row.id,
    spaceId: row.spaceId,
    matrixRoomId: row.matrixRoomId,
    threadKind: row.threadKind as ThreadSummaryKind,
    coherenceSlug: row.coherenceSlug,
    threadTitle: row.threadTitle,
    summary: row.summary,
    bullets: Array.isArray(row.bullets) ? row.bullets : [],
    messageCount: row.messageCount,
    participantCount: row.participantCount,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
    lastRefreshedAt: row.lastRefreshedAt,
  };
}

export async function getThreadSummaryForRoom(
  {
    spaceSlug,
    matrixRoomId,
  }: {
    spaceSlug: string;
    matrixRoomId: string;
  },
  { db }: DbConfig,
): Promise<ThreadSummaryView | null> {
  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return null;
  const roomId = matrixRoomId.trim();
  if (!roomId) return null;
  const [row] = await db
    .select()
    .from(threadSummaries)
    .where(
      and(
        eq(threadSummaries.spaceId, host.id),
        eq(threadSummaries.matrixRoomId, roomId),
      ),
    )
    .limit(1);
  return row ? rowToView(row) : null;
}

export async function recordThreadActivity(
  {
    spaceSlug,
    matrixRoomId,
    threadKind,
    coherenceSlug,
    threadTitle,
    lastMessageEventId,
    lastMessageOriginServerTs,
  }: {
    spaceSlug: string;
    matrixRoomId: string;
    threadKind: ThreadSummaryKind;
    coherenceSlug?: string | null;
    threadTitle?: string | null;
    lastMessageEventId: string;
    lastMessageOriginServerTs: number;
  },
  { db }: DbConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return { ok: false, error: 'Space not found' };
  const roomId = matrixRoomId.trim();
  const eventId = lastMessageEventId.trim();
  if (!roomId || !eventId) {
    return { ok: false, error: 'matrixRoomId and lastMessageEventId required' };
  }
  if (
    !Number.isFinite(lastMessageOriginServerTs) ||
    lastMessageOriginServerTs <= 0
  ) {
    return { ok: false, error: 'Invalid lastMessageOriginServerTs' };
  }

  const [existing] = await db
    .select()
    .from(threadSummaries)
    .where(
      and(
        eq(threadSummaries.spaceId, host.id),
        eq(threadSummaries.matrixRoomId, roomId),
      ),
    )
    .limit(1);

  if (
    existing?.lastMessageOriginServerTs != null &&
    existing.lastMessageOriginServerTs >= lastMessageOriginServerTs
  ) {
    return { ok: true };
  }

  const now = new Date();
  if (existing) {
    await db
      .update(threadSummaries)
      .set({
        threadKind,
        coherenceSlug: coherenceSlug?.trim() || null,
        threadTitle: threadTitle?.trim() || existing.threadTitle,
        lastMessageEventId: eventId,
        lastMessageOriginServerTs: lastMessageOriginServerTs,
        updatedAt: now,
      })
      .where(eq(threadSummaries.id, existing.id));
    return { ok: true };
  }

  await db.insert(threadSummaries).values({
    spaceId: host.id,
    matrixRoomId: roomId,
    threadKind,
    coherenceSlug: coherenceSlug?.trim() || null,
    threadTitle: threadTitle?.trim() || null,
    summary: '',
    bullets: [],
    lastMessageEventId: eventId,
    lastMessageOriginServerTs: lastMessageOriginServerTs,
    updatedAt: now,
  });
  return { ok: true };
}

export async function refreshThreadSummary(
  {
    spaceSlug,
    matrixRoomId,
    authToken,
    requestUrlForSessionMatrix,
    force = false,
    signal,
  }: {
    spaceSlug: string;
    matrixRoomId: string;
    authToken?: string;
    requestUrlForSessionMatrix?: string;
    force?: boolean;
    signal?: AbortSignal;
  },
  { db }: DbConfig,
): Promise<
  | { ok: true; summary: ThreadSummaryView; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string }
> {
  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return { ok: false, error: 'Space not found' };
  const roomId = matrixRoomId.trim();
  if (!roomId) return { ok: false, error: 'matrixRoomId required' };

  const [existing] = await db
    .select()
    .from(threadSummaries)
    .where(
      and(
        eq(threadSummaries.spaceId, host.id),
        eq(threadSummaries.matrixRoomId, roomId),
      ),
    )
    .limit(1);

  const gate = shouldRefreshThreadSummary({
    lastMessageOriginServerTs: existing?.lastMessageOriginServerTs,
    lastSummarizedOriginServerTs: existing?.lastSummarizedOriginServerTs,
    lastRefreshedAt: existing?.lastRefreshedAt,
    force,
  });
  if (!gate.ok) {
    return { ok: true, skipped: true, reason: gate.reason };
  }

  const timeline = await fetchRoomThreadTimeline(
    roomId,
    authToken,
    requestUrlForSessionMatrix,
    signal,
  );
  if (timeline.lines.length < THREAD_SUMMARY_MIN_MESSAGES) {
    return {
      ok: true,
      skipped: true,
      reason: 'insufficient_messages',
    };
  }

  const llmMessages: ThreadSummaryMessageLine[] = timeline.lines.map(
    (line) => ({
      sender: line.sender,
      text: line.text,
    }),
  );

  let summaryText = '';
  let bullets: string[] = [];
  let source = 'llm';

  try {
    const llm = await generateThreadLivingSummaryWithLlm({
      threadTitle: existing?.threadTitle,
      previousSummary: existing?.summary,
      messages: llmMessages,
      signal,
    });
    if (llm) {
      summaryText = llm.summary.trim();
      bullets = llm.bullets.map((b) => b.trim()).filter(Boolean);
    }
  } catch (error) {
    console.error('[thread-summary] LLM generation failed', {
      spaceSlug,
      matrixRoomId: roomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!summaryText) {
    const joined = llmMessages.map((m) => m.text).join(' ');
    summaryText =
      joined.length <= 320 ? joined : `${joined.slice(0, 317).trim()}...`;
    bullets = llmMessages.slice(-3).map((m) => m.text);
    source = 'heuristic_fallback';
  }

  const lastLine = timeline.lines[timeline.lines.length - 1];
  const now = new Date();
  const refreshedAt = now.toISOString();
  const values = {
    summary: summaryText,
    bullets,
    messageCount: timeline.lines.length,
    participantCount: timeline.participantIds.length,
    lastSummarizedEventId: lastLine?.eventId ?? null,
    lastSummarizedOriginServerTs: lastLine?.originServerTs ?? null,
    lastRefreshedAt: refreshedAt,
    source,
    updatedAt: now,
    metadata: {
      refreshedAt,
      messageWindow: timeline.lines.length,
    },
  };

  let row: typeof threadSummaries.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(threadSummaries)
      .set(values)
      .where(eq(threadSummaries.id, existing.id))
      .returning();
    if (!updated)
      return { ok: false, error: 'Failed to update thread summary' };
    row = updated;
  } else {
    const [inserted] = await db
      .insert(threadSummaries)
      .values({
        spaceId: host.id,
        matrixRoomId: roomId,
        threadKind: 'space',
        summary: values.summary,
        bullets: values.bullets,
        messageCount: values.messageCount,
        participantCount: values.participantCount,
        lastSummarizedEventId: values.lastSummarizedEventId,
        lastSummarizedOriginServerTs: values.lastSummarizedOriginServerTs,
        lastMessageEventId: values.lastSummarizedEventId,
        lastMessageOriginServerTs: values.lastSummarizedOriginServerTs,
        lastRefreshedAt: values.lastRefreshedAt,
        source: values.source,
        metadata: values.metadata,
        updatedAt: values.updatedAt,
      })
      .returning();
    if (!inserted) {
      return { ok: false, error: 'Failed to create thread summary' };
    }
    row = inserted;
  }

  return { ok: true, summary: rowToView(row) };
}

export async function listThreadSummariesDueForRefresh(
  { limit = 100 }: { limit?: number },
  { db }: DbConfig,
): Promise<
  Array<{
    spaceSlug: string;
    matrixRoomId: string;
    threadKind: ThreadSummaryKind;
    coherenceSlug: string | null;
  }>
> {
  const cutoff = new Date(
    Date.now() - THREAD_SUMMARY_REFRESH_INTERVAL_MS,
  ).toISOString();

  const rows = await db
    .select({
      slug: spaces.slug,
      matrixRoomId: threadSummaries.matrixRoomId,
      threadKind: threadSummaries.threadKind,
      coherenceSlug: threadSummaries.coherenceSlug,
    })
    .from(threadSummaries)
    .innerJoin(spaces, eq(threadSummaries.spaceId, spaces.id))
    .where(
      and(
        isNotNull(threadSummaries.lastMessageOriginServerTs),
        or(
          isNull(threadSummaries.lastSummarizedOriginServerTs),
          lt(
            threadSummaries.lastSummarizedOriginServerTs,
            threadSummaries.lastMessageOriginServerTs,
          ),
        ),
        or(
          sql`${threadSummaries.lastRefreshedAt} IS NULL`,
          lt(threadSummaries.lastRefreshedAt, cutoff),
        ),
      ),
    )
    .orderBy(desc(threadSummaries.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    spaceSlug: row.slug,
    matrixRoomId: row.matrixRoomId,
    threadKind: row.threadKind as ThreadSummaryKind,
    coherenceSlug: row.coherenceSlug,
  }));
}

export async function listThreadSummariesBySpaceId(
  spaceId: number,
  { db }: DbConfig,
  limit = 50,
): Promise<Array<typeof threadSummaries.$inferSelect>> {
  return db
    .select()
    .from(threadSummaries)
    .where(
      and(
        eq(threadSummaries.spaceId, spaceId),
        sql`${threadSummaries.summary} <> ''`,
      ),
    )
    .orderBy(desc(threadSummaries.updatedAt))
    .limit(limit);
}

export async function getThreadSummaryById(
  { id, spaceId }: { id: number; spaceId: number },
  { db }: DbConfig,
): Promise<typeof threadSummaries.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(threadSummaries)
    .where(
      and(eq(threadSummaries.id, id), eq(threadSummaries.spaceId, spaceId)),
    )
    .limit(1);
  return row ?? null;
}
