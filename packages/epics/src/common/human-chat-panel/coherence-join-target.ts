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
export function shouldRestartCoherenceJoin(input: {
  settledKey: string | null;
  joinKey: string;
  openRoomId: string | null;
}): boolean {
  if (input.settledKey === input.joinKey && input.openRoomId?.trim()) {
    return false;
  }
  return true;
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
