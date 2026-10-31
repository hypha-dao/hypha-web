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
    lastActiveAgo?: number;
    getLastActiveTs?: () => number;
  } | null;
  getRooms?: () => Array<{
    getLiveTimeline?: () => { getEvents?: () => PresenceEvent[] };
  }>;
};

/** Presence plus a last-active timestamp for DM header copy. */
export type MemberPresenceDetail = {
  level: PresenceLevel;
  /** Absolute ms of last activity when known. */
  lastActiveAt: number | null;
  /** False when the homeserver gave no usable presence signal. */
  known: boolean;
};

/** Header line for a DM peer. Hidden when we have nothing trustworthy. */
export type PeerLastSeenLine =
  | { kind: 'online' }
  | { kind: 'lastSeenAt'; at: number }
  | { kind: 'hidden' };

function lastActiveAtFromStatus(
  status: {
    last_active_ago?: number | null;
  },
  now: number,
): number | null {
  const ago = status.last_active_ago;
  if (typeof ago !== 'number' || !Number.isFinite(ago) || ago < 0) return null;
  return now - ago;
}

function cachedLastActiveAt(
  client: PresenceClient,
  matrixUserId: string,
  now: number,
): number | null {
  const known = client.getUser?.(matrixUserId);
  if (!known) return null;
  const fromMethod = known.getLastActiveTs?.();
  if (typeof fromMethod === 'number' && fromMethod > 0) return fromMethod;
  if (
    typeof known.lastActiveAgo === 'number' &&
    Number.isFinite(known.lastActiveAgo) &&
    known.lastActiveAgo >= 0 &&
    known.lastPresenceTs
  ) {
    return now - known.lastActiveAgo;
  }
  if (typeof known.lastPresenceTs === 'number' && known.lastPresenceTs > 0) {
    return known.lastPresenceTs;
  }
  return null;
}

/**
 * Pick the chat-header line from a presence detail. Active → online;
 * otherwise last seen when we have a timestamp; never invent a time.
 */
export function peerLastSeenLine(
  detail: MemberPresenceDetail | null | undefined,
): PeerLastSeenLine {
  if (!detail || !detail.known) return { kind: 'hidden' };
  if (detail.level === 'active') return { kind: 'online' };
  if (detail.lastActiveAt != null && detail.lastActiveAt > 0) {
    return { kind: 'lastSeenAt', at: detail.lastActiveAt };
  }
  return { kind: 'hidden' };
}

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
  const detail = await readMemberPresenceDetail(client, matrixUserId, now);
  return detail.level;
}

/**
 * Presence level plus last-active time for DM “online / last seen” copy.
 * `known` is false only when every Matrix probe failed and nothing is cached.
 */
export async function readMemberPresenceDetail(
  client: PresenceClient,
  matrixUserId: string,
  now = Date.now(),
): Promise<MemberPresenceDetail> {
  let liveStatus: {
    presence?: string | null;
    currently_active?: boolean | null;
    last_active_ago?: number | null;
  } | null = null;
  try {
    liveStatus = await client.getPresence(matrixUserId);
  } catch {
    liveStatus = null;
  }
  const live = liveStatus ? presenceFromMatrixStatus(liveStatus) : null;
  const cached = cachedPresence(client, matrixUserId);
  const messageTs = latestMessageTs(client, matrixUserId);
  const fromMessages = presenceFromRecency(messageTs, now);
  const self =
    client.getUserId?.() === matrixUserId ? ('active' as const) : null;
  // Dots still use message recency. Header last-seen prefers Matrix
  // `last_active_ago`, then falls back to the latest message only when we
  // already know presence (so a failed probe never invents a time).
  const level = preferPresence([live, cached, fromMessages, self]);
  const presenceKnown = Boolean(liveStatus || cached || self);
  const lastActiveAt =
    (liveStatus ? lastActiveAtFromStatus(liveStatus, now) : null) ??
    cachedLastActiveAt(client, matrixUserId, now) ??
    (presenceKnown && messageTs != null && messageTs > 0 ? messageTs : null);
  // Successful getPresence (even offline) is always known. A failed probe
  // with no cache stays unknown so the header stays empty.
  if (presenceKnown) return { level, lastActiveAt, known: true };
  return { level, lastActiveAt: null, known: false };
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
