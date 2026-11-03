import { HYPHA_ROOM_TYPES } from './room-types';

/**
 * A space's public channel is a different Matrix room from its member channel.
 * Returns null when the alias resolved to the member room, or when there is no room.
 */
export function distinctPublicRoomId(
  resolvedRoomId: string | null | undefined,
  memberRoomId: string | null | undefined,
): string | null {
  const resolved = resolvedRoomId?.trim() ?? '';
  if (!resolved) return null;
  const member = memberRoomId?.trim() ?? '';
  if (member && resolved === member) return null;
  return resolved;
}

/** True when `m.room.create` type is the per-space public channel. */
export function isSpacePublicRoomType(
  roomType: string | null | undefined,
): boolean {
  return roomType === HYPHA_ROOM_TYPES.spacePublic;
}

/**
 * Accept a resolved public room only when its create type is
 * `io.hypha.room.space-public` and it is not the member channel.
 * An unknown type is refused: a missing or stale `chatRoomId` must not
 * let the member timeline through under the public label.
 */
export function acceptEnsuredPublicRoomId(
  resolvedRoomId: string | null | undefined,
  memberRoomId: string | null | undefined,
  roomType?: string | null,
): string | null {
  if (!isSpacePublicRoomType(roomType)) return null;
  return distinctPublicRoomId(resolvedRoomId, memberRoomId);
}

const PUBLIC_ROOM_TYPE_POLL_MS = 50;

/**
 * The browser often has the room before `m.room.create` has synced.
 * Wait while the type is still unknown, then accept only `space-public`.
 * A known member type stops immediately.
 */
export async function waitForAcceptedPublicRoomId(input: {
  roomId: string;
  memberRoomId?: string | null;
  readRoomType: () => string | null | undefined;
  waitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<string | null> {
  const waitMs = input.waitMs ?? 2000;
  const now = input.now ?? (() => Date.now());
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + waitMs;
  let roomType = input.readRoomType();
  while (now() < deadline) {
    const accepted = acceptEnsuredPublicRoomId(
      input.roomId,
      input.memberRoomId,
      roomType,
    );
    if (accepted) return accepted;
    if (roomType != null && roomType.trim() !== '') return null;
    await sleep(PUBLIC_ROOM_TYPE_POLL_MS);
    roomType = input.readRoomType();
  }
  return acceptEnsuredPublicRoomId(input.roomId, input.memberRoomId, roomType);
}
