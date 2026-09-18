// server-only: reached only from API route handlers (#2485 POC).

import { matrixJoinRoomAsPuppet } from '@hypha-platform/core/server';
import type { AiBotPocConfig } from './config';
import type { Persona } from './personas';

/**
 * #2485 POC — outbound reply as a `@hyphabot_*` persona.
 *
 * The shared `matrixSendTextMessage` helper (#2428) has no puppeting param, so this does the
 * client-server `send` directly with `?user_id=` + the AS token. Kept POC-local on purpose.
 */

const SEND_TIMEOUT_MS = 15_000;
const HISTORY_TIMEOUT_MS = 10_000;

function personaMxid(persona: Persona, cfg: AiBotPocConfig): string {
  return `@${persona.localpart}:${cfg.serverName}`;
}

interface RawTimelineEvent {
  type?: string;
  sender?: string;
  event_id?: string;
  content?: { msgtype?: string; body?: string };
}

export interface HistoryTurn {
  sender: string;
  body: string;
}

/**
 * Last `limit` prior `m.room.message`/`m.text` turns in `roomId`, oldest first, excluding
 * `excludeEventId` (the message that triggered this call — its body is already the question).
 * Best-effort: quick demo-quality context, not a real conversation-memory layer (see #2478).
 * Bodies are truncated hard; this is NOT a token-budgeting strategy, just a sanity cap.
 */
export async function fetchRecentRoomHistory(
  persona: Persona,
  roomId: string,
  cfg: AiBotPocConfig,
  excludeEventId: string,
  limit = 5,
): Promise<HistoryTurn[]> {
  const mxid = personaMxid(persona, cfg);
  const url =
    `${cfg.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/messages` +
    `?dir=b&limit=${limit + 1}&user_id=${encodeURIComponent(mxid)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.asToken}` },
    signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!res.ok) {
    throw new Error(`matrix history fetch failed (${res.status})`);
  }
  const data = (await res.json()) as { chunk?: RawTimelineEvent[] };
  const chunk = Array.isArray(data.chunk) ? data.chunk : [];

  return chunk
    .filter(
      (
        e,
      ): e is Required<Pick<RawTimelineEvent, 'sender' | 'event_id'>> &
        RawTimelineEvent =>
        e.type === 'm.room.message' &&
        e.content?.msgtype === 'm.text' &&
        Boolean(e.content.body?.trim()) &&
        e.event_id !== excludeEventId &&
        Boolean(e.sender),
    )
    .slice(0, limit) // dir=b is newest-first; take the N most recent (excl. the trigger event)
    .reverse() // oldest -> newest, matching reading order
    .map((e) => ({
      sender: e.sender!,
      body: e.content!.body!.trim().slice(0, 400),
    }));
}

function makeTxnId(): string {
  return `aibotpoc.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
}

/** Best-effort puppet-join; a 403 here usually means the bot needs an invite first. */
export async function ensurePersonaInRoom(
  persona: Persona,
  roomId: string,
  cfg: AiBotPocConfig,
): Promise<void> {
  try {
    await matrixJoinRoomAsPuppet(
      roomId,
      personaMxid(persona, cfg),
      cfg.asToken,
      cfg.homeserverUrl,
    );
  } catch (error) {
    console.warn(
      '[ai-bot-poc] puppet-join failed (bot may need a room invite first)',
      { roomId, persona: persona.localpart, error },
    );
  }
}

/** Posts `text` into `roomId` as the persona. Returns the new event id. */
export async function postAs(
  persona: Persona,
  roomId: string,
  text: string,
  cfg: AiBotPocConfig,
): Promise<string> {
  const mxid = personaMxid(persona, cfg);
  const url =
    `${cfg.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}` +
    `/send/m.room.message/${encodeURIComponent(makeTxnId())}` +
    `?user_id=${encodeURIComponent(mxid)}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfg.asToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ msgtype: 'm.text', body: text }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    redirect: 'error',
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(
      `matrix send failed (${res.status}) as ${mxid}: ${raw.slice(0, 240)}`,
    );
  }
  let eventId: string | undefined;
  try {
    eventId = (JSON.parse(raw) as { event_id?: string }).event_id;
  } catch {
    throw new Error('matrix send returned non-JSON');
  }
  if (!eventId) throw new Error('matrix send returned no event_id');
  return eventId;
}
