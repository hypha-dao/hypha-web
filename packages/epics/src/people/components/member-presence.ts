/** Discord-like presence on Hypha, backed by Matrix. */
export type PresenceLevel = 'active' | 'idle' | 'offline';

export function presenceRank(level: PresenceLevel): number {
  if (level === 'active') return 0;
  if (level === 'idle') return 1;
  return 2;
}

/** A message this recent means the person is at the keyboard. */
const RECENT_ACTIVE_MS = 5 * 60 * 1000;
/** Still around, but not in the last few minutes. */
const RECENT_IDLE_MS = 30 * 60 * 1000;
/** How many live events to scan per room when presence itself is missing. */
const ACTIVITY_SCAN = 40;

/**
 * Matrix `online` + active → green. `unavailable`, or online but not
 * currently active → yellow. A recent `last_active_ago` still counts when
 * the homeserver has already flipped the flag to offline.
 */
export function presenceFromMatrixStatus(status: {
  presence?: string | null;
  currently_active?: boolean | null;
  last_active_ago?: number | null;
}): PresenceLevel {
  const presence = status.presence?.trim().toLowerCase() ?? '';
  if (presence === 'unavailable') return 'idle';
  if (presence === 'online') {
    if (status.currently_active === false) return 'idle';
    return 'active';
  }
  const ago = status.last_active_ago;
  if (typeof ago === 'number' && ago > 0) {
    if (ago <= RECENT_ACTIVE_MS) return 'active';
    if (ago <= RECENT_IDLE_MS) return 'idle';
  }
  return 'offline';
}

/** The more present of the two. Unknown levels are ignored. */
export function preferPresence(
  levels: readonly (PresenceLevel | null | undefined)[],
): PresenceLevel {
  let best: PresenceLevel = 'offline';
  for (const level of levels) {
    if (!level) continue;
    if (presenceRank(level) < presenceRank(best)) best = level;
  }
  return best;
}

export function presenceFromRecency(
  lastTs: number | null | undefined,
  now = Date.now(),
): PresenceLevel | null {
  if (lastTs == null || !Number.isFinite(lastTs) || lastTs <= 0) return null;
  const ago = now - lastTs;
  if (ago <= RECENT_ACTIVE_MS) return 'active';
  if (ago <= RECENT_IDLE_MS) return 'idle';
  return null;
}

type PresenceEvent = {
  getSender?: () => string | undefined;
  getTs?: () => number;
  getType?: () => string;
};

type PresenceClient = {
  getPresence: (userId: string) => Promise<{
    presence?: string | null;
    currently_active?: boolean | null;
    last_active_ago?: number | null;
  }>;
  getUserId?: () => string | null;
  getUser?: (userId: string) => {
    presence?: string;
    currentlyActive?: boolean;
    lastPresenceTs?: number;
  } | null;
  getRooms?: () => Array<{
    getLiveTimeline?: () => { getEvents?: () => PresenceEvent[] };
  }>;
};

function cachedPresence(
  client: PresenceClient,
  matrixUserId: string,
): PresenceLevel | null {
  const known = client.getUser?.(matrixUserId);
  // An untouched user record defaults to offline and is not evidence.
  if (!known?.lastPresenceTs) return null;
  return presenceFromMatrixStatus({
    presence: known.presence,
    currently_active: known.currentlyActive,
  });
}

/** Latest human message from this account across joined rooms. */
export function latestMessageTs(
  client: Pick<PresenceClient, 'getRooms'>,
  matrixUserId: string,
): number | null {
  const rooms = client.getRooms?.() ?? [];
  let latest = 0;
  for (const room of rooms) {
    const events = room.getLiveTimeline?.().getEvents?.() ?? [];
    const start = Math.max(0, events.length - ACTIVITY_SCAN);
    for (let index = events.length - 1; index >= start; index -= 1) {
      const event = events[index];
      if (event?.getSender?.() !== matrixUserId) continue;
      if (event.getType?.() !== 'm.room.message') break;
      const ts = event.getTs?.() ?? 0;
      if (ts > latest) latest = ts;
      break;
    }
  }
  return latest > 0 ? latest : null;
}

/**
 * Live presence, a presence event already in sync, a recent message, and
 * this signed-in session. An empty homeserver answer must not hide a
 * stronger signal — that is what left every light off.
 */
export async function readMemberPresence(
  client: PresenceClient,
  matrixUserId: string,
  now = Date.now(),
): Promise<PresenceLevel> {
  let live: PresenceLevel | null = null;
  try {
    live = presenceFromMatrixStatus(await client.getPresence(matrixUserId));
  } catch {
    live = null;
  }
  const self =
    client.getUserId?.() === matrixUserId ? ('active' as const) : null;
  return preferPresence([
    live,
    cachedPresence(client, matrixUserId),
    presenceFromRecency(latestMessageTs(client, matrixUserId), now),
    self,
  ]);
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
  T extends {
    lastTs: number | null;
    person: { id: number };
    name: string;
    unread?: number;
  },
>(rows: readonly T[], presence: ReadonlyMap<number, PresenceLevel>): T[] {
  return [...rows].sort((left, right) => {
    const byUnread = (right.unread ?? 0) - (left.unread ?? 0);
    if (byUnread !== 0) return byUnread;
    const byTime = (right.lastTs ?? 0) - (left.lastTs ?? 0);
    if (byTime !== 0) return byTime;
    const byPresence =
      presenceRank(presence.get(left.person.id) ?? 'offline') -
      presenceRank(presence.get(right.person.id) ?? 'offline');
    if (byPresence !== 0) return byPresence;
    return left.name.localeCompare(right.name);
  });
}
