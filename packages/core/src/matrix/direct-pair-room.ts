import { createHash } from 'crypto';

/**
 * One directory alias per pair. The two Matrix ids are sorted first, so each
 * person computes the same alias and cannot create a second room.
 */
export function directPairAliasLocalpart(
  selfUserId: string,
  otherUserId: string,
): string | null {
  const self = selfUserId.trim().toLowerCase();
  const other = otherUserId.trim().toLowerCase();
  if (!self || !other || self === other) return null;
  const [first, second] = self < other ? [self, other] : [other, self];
  const digest = createHash('sha256')
    .update(`${first}\n${second}`)
    .digest('hex')
    .slice(0, 32);
  return `hypha-dm-${digest}`;
}

/**
 * A private pair room. The org bot does not count. A third person means a
 * group, which must not be reused as the direct chat.
 */
export function isDirectPairRoom(
  memberIds: readonly string[],
  selfUserId: string,
  otherUserId: string,
  isBot: (userId: string) => boolean,
): boolean {
  const self = selfUserId.trim().toLowerCase();
  const other = otherUserId.trim().toLowerCase();
  if (!self || !other || self === other) return false;
  const humans = new Set<string>();
  for (const memberId of memberIds) {
    const id = memberId.trim();
    if (!id || isBot(id)) continue;
    humans.add(id.toLowerCase());
  }
  if (humans.size === 0 || humans.size > 2) return false;
  for (const id of humans) {
    if (id !== self && id !== other) return false;
  }
  return humans.has(self) || humans.has(other);
}

/** A signal thread is not a private message, even when only two people are in it. */
export function isSignalThreadMessageContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false;
  const row = content as Record<string, unknown>;
  const msgtype = typeof row.msgtype === 'string' ? row.msgtype.trim() : '';
  if (
    msgtype === 'io.hypha.signal.team.v1' ||
    msgtype === 'io.hypha.signal.team.request.v1'
  ) {
    return true;
  }
  const body = typeof row.body === 'string' ? row.body.trim() : '';
  if (
    body.startsWith('[hypha:signal-team]') ||
    body.startsWith('[hypha:signal-team-request]')
  ) {
    return true;
  }
  const slug =
    typeof row.coherenceSlug === 'string' ? row.coherenceSlug.trim() : '';
  return slug.length > 0;
}

/**
 * The room this pair should keep. The latest message wins, so a newer
 * duplicate replaces an older empty one. A tie keeps the smaller room id.
 */
export function pickDirectPairRoom(
  rooms: readonly { roomId: string; lastMessageTs: number }[],
): string | null {
  let chosen: { roomId: string; lastMessageTs: number } | null = null;
  for (const room of rooms) {
    const roomId = room.roomId.trim();
    if (!roomId) continue;
    if (
      !chosen ||
      room.lastMessageTs > chosen.lastMessageTs ||
      (room.lastMessageTs === chosen.lastMessageTs && roomId < chosen.roomId)
    ) {
      chosen = { roomId, lastMessageTs: room.lastMessageTs };
    }
  }
  return chosen?.roomId ?? null;
}
