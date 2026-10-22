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
