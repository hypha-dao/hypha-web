import 'server-only';

import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { coherences } from '@hypha-platform/storage-postgres';
import type { DatabaseInstance } from '../../common/server/types';
import { isHyphaBotMatrixIdentity } from '../../matrix/matrix-member-display';
import {
  collectDiscussionTimeline,
  summarizeHumanDiscussionTimeline,
} from '../../matrix/human-discussion-count';
import {
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixJoinRoom,
  matrixListRoomMessages,
} from '../../matrix/server/matrix-http-client';
import { updateCoherenceBySlug } from './mutations';

const activeSignal = or(
  eq(coherences.archived, false),
  isNull(coherences.archived),
);

export type SignalDiscussionRecount = {
  slug: string;
  comments: number;
  /** False when the stored total already matched. */
  updated: boolean;
};

/**
 * Replace `coherences.messages` with the human-bubble count of the room.
 *
 * Returns null without writing when Matrix is unavailable, the room is not a
 * signal, or scrollback does not reach the start. A partial timeline must not
 * overwrite the stored total.
 */
export async function recountSignalDiscussionByRoomId(
  { roomId }: { roomId: string },
  { db }: { db: DatabaseInstance },
): Promise<SignalDiscussionRecount | null> {
  const id = roomId.trim();
  if (!id) return null;
  const rows = await db
    .select({
      slug: coherences.slug,
      messages: coherences.messages,
    })
    .from(coherences)
    .where(and(eq(coherences.roomId, id), activeSignal));
  const target = rows.find((row) => row.slug?.trim());
  if (!target?.slug) return null;

  const homeserver = getMatrixHomeserverUrl();
  const accessToken = getMatrixBotAsToken();
  if (!homeserver || !accessToken) return null;

  try {
    await matrixJoinRoom(id, accessToken, homeserver);
    const collected = await collectDiscussionTimeline((from) =>
      matrixListRoomMessages(id, accessToken, homeserver, {
        limit: 100,
        from,
      }),
    );
    if (!collected.reachedStart) return null;
    const summary = summarizeHumanDiscussionTimeline(collected.events, {
      isBot: (sender) => isHyphaBotMatrixIdentity(sender),
    });
    const slug = target.slug.trim();
    if ((target.messages ?? 0) === summary.comments) {
      return { slug, comments: summary.comments, updated: false };
    }
    await updateCoherenceBySlug({ slug, messages: summary.comments }, { db });
    return { slug, comments: summary.comments, updated: true };
  } catch (error) {
    console.warn(
      '[signal-discussion] Could not recount',
      id,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export type SignalDiscussionBackfillResult = {
  examined: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

/**
 * Recompute `coherences.messages` for every active signal that has a room.
 * Does not run on migrate. Callers decide whether to execute it.
 */
export async function backfillSignalDiscussionCounts({
  db,
}: {
  db: DatabaseInstance;
}): Promise<SignalDiscussionBackfillResult> {
  const rows = await db
    .select({ roomId: coherences.roomId })
    .from(coherences)
    .where(and(isNotNull(coherences.roomId), activeSignal));
  const result: SignalDiscussionBackfillResult = {
    examined: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
  };
  const seen = new Set<string>();
  for (const row of rows) {
    const roomId = row.roomId?.trim();
    if (!roomId || seen.has(roomId)) continue;
    seen.add(roomId);
    result.examined += 1;
    const recounted = await recountSignalDiscussionByRoomId({ roomId }, { db });
    if (!recounted) {
      result.failed += 1;
      continue;
    }
    if (recounted.updated) result.updated += 1;
    else result.unchanged += 1;
  }
  result.skipped = rows.length - seen.size;
  return result;
}
