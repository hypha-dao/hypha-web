import { createHash } from 'node:crypto';
import { RoomServiceClient } from 'livekit-server-sdk';

/**
 * The legacy `/sfu/get` endpoint (still in use, see D1 in #2456's decisions) always uses this
 * hardcoded MatrixRTC slot id server-side — `lk-jwt-service`'s `processLegacySFURequest` sets
 * `slotId := "m.call#ROOM"` itself; the client never sends one for this endpoint.
 */
const LEGACY_MATRIX_RTC_SLOT_ID = 'm.call#ROOM';

/**
 * Mirrors `lk-jwt-service`'s `LiveKitRoomAliasFor(matrixRoom, slotId)` exactly —
 * `base64_nopad(sha256(json.Marshal([matrixRoom, slotId])))` — so this route can find the LiveKit
 * room a Matrix room maps to without lk-jwt-service exposing that mapping itself. Source:
 * https://github.com/element-hq/lk-jwt-service/blob/main/helper.go
 *
 * Fragile by construction: if lk-jwt-service ever changes this formula, this silently starts
 * deriving the wrong room alias. Revisit if #2465 (the `/get_token` migration) lands.
 */
export function deriveLegacyLivekitRoomAlias(matrixRoomId: string): string {
  const input = JSON.stringify([matrixRoomId, LEGACY_MATRIX_RTC_SLOT_ID]);
  return createHash('sha256')
    .update(input, 'utf8')
    .digest('base64')
    .replace(/=+$/, '');
}

/**
 * Duplicated here (not imported) from `matrixUserIdFromLiveKitIdentity` in the client hooks'
 * `livekit-call-helpers.ts` — that file pulls in `livekit-client`, which has no business in a
 * server route. Keep the two in sync if the identity format changes.
 *
 * The legacy `lk-jwt-service` `/sfu/get` flow issues tokens without the `canUpdateOwnMetadata`
 * grant, so `setMetadata()` always fails client-side (confirmed via #2456 debugging:
 * `SignalRequestError: does not have permission to update own metadata`) — every participant's
 * metadata is permanently empty under this flow, so `parseMatrixUserIdFromMetadata` alone can
 * never match anything, and eviction always no-ops. Identity is always reliably
 * `${matrixUserId}:${tabId}` (a Matrix user id always contains `:`, a tabId UUID never does), so
 * fall back to parsing it whenever metadata comes up empty.
 */
function matrixUserIdFromLiveKitIdentity(identity: string): string | null {
  const lastColon = identity.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const candidate = identity.slice(0, lastColon);
  return candidate.startsWith('@') && candidate.includes(':')
    ? candidate
    : null;
}

function parseMatrixUserIdFromMetadata(
  metadata: string | undefined,
): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { matrixUserId?: unknown };
    return typeof parsed.matrixUserId === 'string' && parsed.matrixUserId
      ? parsed.matrixUserId
      : null;
  } catch {
    return null;
  }
}

function resolveMatrixUserIdFromParticipant(participant: {
  identity: string;
  metadata?: string;
}): string | null {
  return (
    parseMatrixUserIdFromMetadata(participant.metadata) ??
    matrixUserIdFromLiveKitIdentity(participant.identity)
  );
}

function getRoomServiceClient(): RoomServiceClient | null {
  const url = process.env.LIVEKIT_SERVER_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  return new RoomServiceClient(url, apiKey, apiSecret);
}

/**
 * Evicts the caller's own stale LiveKit participant(s) from a call room, ahead of a fresh rejoin
 * (the "Refresh call" flow — #2456 D2, scenarios 1 and 3). Only ever targets participants whose
 * published metadata resolves to `matrixUserId` — the caller can only evict their own sessions,
 * never anyone else's (see #2456 decisions.md D2a's security note).
 */
export async function evictStaleLivekitParticipants({
  matrixRoomId,
  matrixUserId,
}: {
  matrixRoomId: string;
  matrixUserId: string;
}): Promise<{ ok: true; evictedCount: number } | { ok: false; error: string }> {
  const client = getRoomServiceClient();
  if (!client) {
    return {
      ok: false,
      error:
        'LiveKit server credentials not configured (LIVEKIT_SERVER_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET)',
    };
  }

  const roomAlias = deriveLegacyLivekitRoomAlias(matrixRoomId);
  let participants;
  try {
    participants = await client.listParticipants(roomAlias);
  } catch {
    // No LiveKit room yet (nobody has joined) is a normal, non-error case for this flow.
    return { ok: true, evictedCount: 0 };
  }

  const staleIdentities = participants
    .filter((p) => resolveMatrixUserIdFromParticipant(p) === matrixUserId)
    .map((p) => p.identity);

  let evictedCount = 0;
  for (const identity of staleIdentities) {
    try {
      await client.removeParticipant(roomAlias, identity);
      evictedCount += 1;
    } catch {
      // Already gone (e.g. disconnected between listParticipants and removeParticipant) —
      // not a failure worth surfacing to the rejoining client.
    }
  }

  return { ok: true, evictedCount };
}
