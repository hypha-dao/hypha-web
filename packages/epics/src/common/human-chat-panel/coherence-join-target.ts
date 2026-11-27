export type CoherenceJoinTarget = {
  roomId: string | null;
  slug: string;
  spaceSlug: string;
  isPublic: boolean;
  channel: string | null;
};

/** Identity of the thread the panel is opening. Titles are not part of it. */
export function coherenceJoinTargetKey(target: CoherenceJoinTarget): string {
  return [
    target.roomId?.trim() ?? '',
    target.slug.trim(),
    target.spaceSlug.trim(),
    target.isPublic ? '1' : '0',
    target.channel?.trim() ?? '',
  ].join('\n');
}

/**
 * A title, logo, or Matrix flag change must not tear the thread down again.
 * Only a new target, or a join that never settled, starts over.
 */
function sameCoherenceTarget(settledKey: string, joinKey: string): boolean {
  const settled = settledKey.split('\n');
  const join = joinKey.split('\n');
  if (settled.length !== join.length) return false;
  const settledRoom = settled[0]?.trim() ?? '';
  const joinRoom = join[0]?.trim() ?? '';
  if (settledRoom && joinRoom && settledRoom !== joinRoom) return false;
  for (let index = 1; index < settled.length; index += 1) {
    if ((settled[index] ?? '') !== (join[index] ?? '')) return false;
  }
  return true;
}

export function shouldRestartCoherenceJoin(input: {
  settledKey: string | null;
  joinKey: string;
  openRoomId: string | null;
}): boolean {
  if (
    !input.settledKey ||
    !sameCoherenceTarget(input.settledKey, input.joinKey)
  ) {
    return true;
  }
  const openRoomId = input.openRoomId?.trim() ?? '';
  if (!openRoomId) return true;
  const settledRoomId = input.settledKey.split('\n')[0]?.trim() ?? '';
  const joinRoomId = input.joinKey.split('\n')[0]?.trim() ?? '';
  const expectedRoomId = settledRoomId || joinRoomId;
  // An empty room id must not treat whatever is on screen (a space room,
  // for example) as this thread.
  if (!expectedRoomId || expectedRoomId !== openRoomId) return true;
  return false;
}

/**
 * Blanking the timeline is only for a different room. Restarting the same
 * join (the effect re-ran) keeps whatever is already on screen.
 */
export function shouldResetCoherenceTimeline(input: {
  intendedRoomId: string | null;
  openRoomId: string | null;
  openingRoomId: string | null;
}): boolean {
  const intended = input.intendedRoomId?.trim() || '';
  if (!intended) return true;
  const open = input.openRoomId?.trim() || '';
  const opening = input.openingRoomId?.trim() || '';
  return open !== intended && opening !== intended;
}
