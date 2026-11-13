/**
 * Recompute `coherences.messages` from each signal room's Matrix timeline.
 *
 * Uses the same human-bubble predicate as the chat. Bot posts, the seeded
 * description (when the bot sent it), and notices are not comments. A person's
 * message is, including one whose plaintext body matches the description.
 *
 * Dry run unless `--execute` is passed. This is not part of `migrate` and it
 * is not run by the app. Do not pass `--execute` against production unless
 * you intend to rewrite stored comment counts.
 *
 *   pnpm exec tsx packages/core/scripts/backfill-signal-discussion-counts.ts
 *   pnpm exec tsx packages/core/scripts/backfill-signal-discussion-counts.ts --execute
 *
 * Requires NEXT_PUBLIC_MATRIX_HOMESERVER_URL, HYPHA_MATRIX_BOT_AS_TOKEN, and
 * BRANCH_DB_URL or DEFAULT_DB_URL. Self-contained Matrix HTTP so it does not
 * import the server-only Matrix client.
 */
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { coherences, db } from '@hypha-platform/storage-postgres';
import { isHyphaBotMatrixIdentity } from '../src/matrix/matrix-member-display';
import {
  collectDiscussionTimeline,
  summarizeHumanDiscussionTimeline,
} from '../src/matrix/human-discussion-count';

const execute = process.argv.includes('--execute');
const MATRIX_HTTP_TIMEOUT_MS = 20_000;

function matrixFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(MATRIX_HTTP_TIMEOUT_MS),
    redirect: 'error',
  });
}

async function readMatrixJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text.trim().slice(0, 240) ||
        `Matrix request failed with status ${res.status}`,
    );
  }
  return JSON.parse(text) as T;
}

function homeserverUrl(): string {
  const raw = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim();
  if (!raw) throw new Error('NEXT_PUBLIC_MATRIX_HOMESERVER_URL is not set');
  return raw.replace(/\/?$/, '');
}

function botToken(): string {
  const token = process.env.HYPHA_MATRIX_BOT_AS_TOKEN?.trim();
  if (!token) throw new Error('HYPHA_MATRIX_BOT_AS_TOKEN is not set');
  return token;
}

async function joinRoom(
  roomId: string,
  token: string,
  homeserver: string,
): Promise<void> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/join/${encodeURIComponent(roomId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  await readMatrixJson(res);
}

async function listMessages(
  roomId: string,
  token: string,
  homeserver: string,
  from?: string,
): Promise<{ chunk: unknown[]; end?: string }> {
  const params = new URLSearchParams({ dir: 'b', limit: '100' });
  if (from) params.set('from', from);
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await readMatrixJson<{
    chunk?: unknown[];
    end?: string;
  }>(res);
  return {
    chunk: Array.isArray(data.chunk) ? data.chunk : [],
    end: data.end,
  };
}

async function main(): Promise<void> {
  const homeserver = homeserverUrl();
  const token = botToken();
  const rows = await db
    .select({
      slug: coherences.slug,
      roomId: coherences.roomId,
      messages: coherences.messages,
    })
    .from(coherences)
    .where(
      and(
        isNotNull(coherences.roomId),
        or(eq(coherences.archived, false), isNull(coherences.archived)),
      ),
    );

  let examined = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const roomId = row.roomId?.trim();
    const slug = row.slug?.trim();
    if (!roomId || !slug || seen.has(roomId)) {
      skipped += 1;
      continue;
    }
    seen.add(roomId);
    examined += 1;
    try {
      await joinRoom(roomId, token, homeserver);
      const collected = await collectDiscussionTimeline((from) =>
        listMessages(roomId, token, homeserver, from),
      );
      if (!collected.reachedStart) {
        console.log(`${slug} skipped (timeline did not reach the room start)`);
        skipped += 1;
        continue;
      }
      const summary = summarizeHumanDiscussionTimeline(collected.events, {
        isBot: (sender) => isHyphaBotMatrixIdentity(sender),
      });
      const stored = row.messages ?? 0;
      if (stored === summary.comments) {
        unchanged += 1;
        continue;
      }
      console.log(
        `${execute ? 'update' : 'would update'} ${slug}: ${stored} -> ${
          summary.comments
        }`,
      );
      if (execute) {
        await db
          .update(coherences)
          .set({ messages: summary.comments })
          .where(eq(coherences.slug, slug));
        updated += 1;
      }
    } catch (error) {
      console.warn(
        `${slug} failed:`,
        error instanceof Error ? error.message : error,
      );
      skipped += 1;
    }
  }
  console.log(
    JSON.stringify({
      execute,
      examined,
      updated,
      unchanged,
      skipped,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
