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
 * Accept a resolved public room only when it is not the member channel
 * and, when a type is known, it is actually `space-public`.
 *
 * An untyped room is accepted only if we have a member id to prove it
 * is distinct — otherwise a misbound `#hypha-public-{slug}` alias that
 * points at the member timeline would be opened silently.
 */
export function acceptEnsuredPublicRoomId(
  resolvedRoomId: string | null | undefined,
  memberRoomId: string | null | undefined,
  roomType?: string | null,
): string | null {
  const distinct = distinctPublicRoomId(resolvedRoomId, memberRoomId);
  if (!distinct) return null;
  if (isSpacePublicRoomType(roomType)) return distinct;
  if (roomType === HYPHA_ROOM_TYPES.space) return null;
  if (roomType == null || roomType.trim() === '') {
    return memberRoomId?.trim() ? distinct : null;
  }
  return null;
}
