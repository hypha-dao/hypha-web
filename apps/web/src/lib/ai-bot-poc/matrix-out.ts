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

function personaMxid(persona: Persona, cfg: AiBotPocConfig): string {
  return `@${persona.localpart}:${cfg.serverName}`;
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
