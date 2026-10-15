/** Discord-like presence on Hypha, backed by Matrix. */
export type PresenceLevel = 'active' | 'idle' | 'offline';

export function presenceRank(level: PresenceLevel): number {
  if (level === 'active') return 0;
  if (level === 'idle') return 1;
  return 2;
}

/**
 * Matrix `online` + active → green. `unavailable`, or online but not
 * currently active → yellow. Everything else → empty.
 */
export function presenceFromMatrixStatus(status: {
  presence?: string | null;
  currently_active?: boolean | null;
}): PresenceLevel {
  const presence = status.presence?.trim().toLowerCase() ?? '';
  if (presence === 'unavailable') return 'idle';
  if (presence === 'online') {
    if (status.currently_active === false) return 'idle';
    return 'active';
  }
  return 'offline';
}

export function sortByPresenceThenShared<
  T extends { id: number; sharedSpaceCount: number },
>(people: readonly T[], presence: ReadonlyMap<number, PresenceLevel>): T[] {
  return [...people].sort((left, right) => {
    const byPresence =
      presenceRank(presence.get(left.id) ?? 'offline') -
      presenceRank(presence.get(right.id) ?? 'offline');
    if (byPresence !== 0) return byPresence;
    const byShared = right.sharedSpaceCount - left.sharedSpaceCount;
    if (byShared !== 0) return byShared;
    return left.id - right.id;
  });
}

export function sortByRecencyThenPresence<
  T extends { lastTs: number | null; person: { id: number }; name: string },
>(rows: readonly T[], presence: ReadonlyMap<number, PresenceLevel>): T[] {
  return [...rows].sort((left, right) => {
    const byTime = (right.lastTs ?? 0) - (left.lastTs ?? 0);
    if (byTime !== 0) return byTime;
    const byPresence =
      presenceRank(presence.get(left.person.id) ?? 'offline') -
      presenceRank(presence.get(right.person.id) ?? 'offline');
    if (byPresence !== 0) return byPresence;
    return left.name.localeCompare(right.name);
  });
}
