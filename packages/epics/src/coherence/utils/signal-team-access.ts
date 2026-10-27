export const SIGNAL_TEAM_EVENT_KIND = 'io.hypha.signal.team.v1';
export const SIGNAL_TEAM_REQUEST_EVENT_KIND = 'io.hypha.signal.team.request.v1';
export const SIGNAL_TEAM_EVENT_BODY_MARKER = '[hypha:signal-team]';
export const SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER =
  '[hypha:signal-team-request]';

function normalizeMatrixUserIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of ids) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export type SignalTeamTimelineEvent = {
  getType: () => string;
  getContent: () => Record<string, unknown> | null;
};

/**
 * True for the roster event the Signal Team picker writes:
 * `m.room.message` + `m.notice` body `[hypha:signal-team]`, or the older
 * `io.hypha.signal.team.v1` msgtype.
 */
export function isSignalTeamRosterContent(
  content: Record<string, unknown> | null | undefined,
): boolean {
  if (!content || typeof content !== 'object') return false;
  const msgtype =
    typeof content.msgtype === 'string' ? content.msgtype.trim() : '';
  const body = typeof content.body === 'string' ? content.body.trim() : '';
  return (
    body.startsWith(SIGNAL_TEAM_EVENT_BODY_MARKER) ||
    msgtype === SIGNAL_TEAM_EVENT_KIND
  );
}

export function readSignalTeamRosterFromEvents(
  events: readonly SignalTeamTimelineEvent[],
  coherenceSlug?: string,
): {
  hasPolicy: boolean;
  memberMatrixUserIds: string[];
  ownerMatrixUserId: string | null;
} {
  const targetSlug = coherenceSlug?.trim() || null;
  let hasPolicy = false;
  let members: string[] = [];
  let ownerMatrixUserId: string | null = null;
  for (const event of events) {
    if (event.getType() !== 'm.room.message') continue;
    const content = event.getContent();
    if (!isSignalTeamRosterContent(content)) continue;
    const eventSlug =
      typeof content?.coherenceSlug === 'string'
        ? content.coherenceSlug.trim()
        : '';
    if (targetSlug && eventSlug && eventSlug !== targetSlug) continue;
    members = normalizeMatrixUserIds(content?.memberMatrixUserIds);
    const nextOwner =
      typeof content?.ownerMatrixUserId === 'string'
        ? content.ownerMatrixUserId.trim()
        : '';
    if (nextOwner) ownerMatrixUserId = nextOwner;
    hasPolicy = true;
  }
  return { hasPolicy, memberMatrixUserIds: members, ownerMatrixUserId };
}

export function getSignalTeamMembersFromRoom(options: {
  room: {
    getLiveTimeline: () => {
      getEvents: () => SignalTeamTimelineEvent[];
    };
  } | null;
  coherenceSlug?: string;
}): {
  hasPolicy: boolean;
  memberMatrixUserIds: string[];
  ownerMatrixUserId: string | null;
} {
  const { room, coherenceSlug } = options;
  if (!room) {
    return {
      hasPolicy: false,
      memberMatrixUserIds: [],
      ownerMatrixUserId: null,
    };
  }
  return readSignalTeamRosterFromEvents(
    room.getLiveTimeline().getEvents(),
    coherenceSlug,
  );
}
