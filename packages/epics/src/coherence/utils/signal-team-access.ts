export const SIGNAL_TEAM_EVENT_KIND = 'io.hypha.signal.team.v1';
export const SIGNAL_TEAM_REQUEST_EVENT_KIND = 'io.hypha.signal.team.request.v1';
export const SIGNAL_TEAM_EVENT_BODY_MARKER = '[hypha:signal-team]';
export const SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER =
  '[hypha:signal-team-request]';
/** Matrix room admin / moderator power — trusted to publish team policy. */
export const SIGNAL_TEAM_TRUSTED_POWER_LEVEL = 50;

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
  getSender?: () => string | null | undefined;
};

export type ReadSignalTeamRosterOptions = {
  /** Room power level for the event sender. Defaults to 0 when omitted. */
  getPowerLevel?: (userId: string | null) => number;
};

/**
 * True when the sender may change Signal Team policy: already-established
 * owner or member, or verified room power ≥ 50. Never trust an owner MXID
 * claimed only in the event content.
 */
export function isTrustedSignalTeamSender(options: {
  senderId?: string | null;
  establishedOwnerMatrixUserId?: string | null;
  establishedMemberMatrixUserIds?: readonly string[];
  powerLevel?: number | null;
}): boolean {
  const senderId = options.senderId?.trim() || null;
  if (!senderId) return false;
  if (
    options.establishedOwnerMatrixUserId &&
    options.establishedOwnerMatrixUserId === senderId
  ) {
    return true;
  }
  if (options.establishedMemberMatrixUserIds?.includes(senderId)) {
    return true;
  }
  return (options.powerLevel ?? 0) >= SIGNAL_TEAM_TRUSTED_POWER_LEVEL;
}

/**
 * True for a join-request notice: body `[hypha:signal-team-request]`, or the
 * older `io.hypha.signal.team.request.v1` msgtype.
 *
 * Check this before roster content — the request marker starts with
 * `[hypha:signal-team]`.
 */
export function isSignalTeamRequestContent(
  content: Record<string, unknown> | null | undefined,
): boolean {
  if (!content || typeof content !== 'object') return false;
  const msgtype =
    typeof content.msgtype === 'string' ? content.msgtype.trim() : '';
  const body = typeof content.body === 'string' ? content.body.trim() : '';
  return (
    body.startsWith(SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER) ||
    msgtype === SIGNAL_TEAM_REQUEST_EVENT_KIND
  );
}

/**
 * True for the roster event the Signal Team picker writes:
 * `m.room.message` + `m.notice` body `[hypha:signal-team]`, or the older
 * `io.hypha.signal.team.v1` msgtype. Request notices are not roster notices.
 */
export function isSignalTeamRosterContent(
  content: Record<string, unknown> | null | undefined,
): boolean {
  if (!content || typeof content !== 'object') return false;
  if (isSignalTeamRequestContent(content)) return false;
  const msgtype =
    typeof content.msgtype === 'string' ? content.msgtype.trim() : '';
  const body = typeof content.body === 'string' ? content.body.trim() : '';
  return (
    body.startsWith(SIGNAL_TEAM_EVENT_BODY_MARKER) ||
    msgtype === SIGNAL_TEAM_EVENT_KIND
  );
}

/**
 * A real roster policy notice always sends `memberMatrixUserIds` as an array,
 * including `[]` for a trusted empty team. A missing field is an incomplete
 * local echo / misclassified event — not a fail-closed empty policy.
 */
export function hasExplicitSignalTeamMemberList(
  content: Record<string, unknown> | null | undefined,
): boolean {
  return Array.isArray(content?.memberMatrixUserIds);
}

export function readSignalTeamRosterFromEvents(
  events: readonly SignalTeamTimelineEvent[],
  coherenceSlug?: string | null,
  options?: ReadSignalTeamRosterOptions,
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
    if (!hasExplicitSignalTeamMemberList(content)) continue;
    const eventSlug =
      typeof content?.coherenceSlug === 'string'
        ? content.coherenceSlug.trim()
        : '';
    if (targetSlug && eventSlug && eventSlug !== targetSlug) continue;
    const senderId = event.getSender?.()?.trim() || null;
    const powerLevel = options?.getPowerLevel?.(senderId) ?? 0;
    if (
      !isTrustedSignalTeamSender({
        senderId,
        establishedOwnerMatrixUserId: ownerMatrixUserId,
        establishedMemberMatrixUserIds: members,
        powerLevel,
      })
    ) {
      continue;
    }
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

/**
 * True when at least one roster MXID is one the Manage picker can mark
 * selected — i.e. it appears in the space person→Matrix map. A notice that
 * only carries `client.getUserId()` (a different linked MXID) is unusable
 * even if the event itself is trusted.
 */
/** Person ids that have no linked Matrix user id in the space map. */
export function unmappedPersonIds(
  personIds: readonly number[],
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
): number[] {
  return personIds.filter((id) => !personIdToMatrixUserId[id]?.trim());
}

export type SignalTeamDocumentSeed = {
  key: string;
  memberIds: string[];
  ownerId: string | null;
};

/** Room + signal slug key for the document-derived roster seed. */
export function signalTeamDocumentSeedKey(
  roomId: string,
  coherenceSlug?: string | null,
): string {
  return `${roomId}:${coherenceSlug ?? ''}`;
}

/**
 * Keep the create/document seed across hydration reruns (e.g. opening Manage).
 * Reset only when the room or signal slug changes.
 */
export function retainSignalTeamDocumentSeed(
  seed: SignalTeamDocumentSeed,
  key: string,
): SignalTeamDocumentSeed {
  if (seed.key === key) return seed;
  return { key, memberIds: [], ownerId: null };
}

export function rosterIdsIntersectSpaceMap(
  memberMatrixUserIds: readonly string[],
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
): boolean {
  const mapped = new Set<string>();
  for (const value of Object.values(personIdToMatrixUserId)) {
    const trimmed = value?.trim();
    if (trimmed) mapped.add(trimmed);
  }
  if (mapped.size === 0) return false;
  return memberMatrixUserIds.some((id) => mapped.has(id.trim()));
}

export function getSignalTeamMembersFromRoom(options: {
  room: {
    getLiveTimeline: () => {
      getEvents: () => SignalTeamTimelineEvent[];
    };
  } | null;
  coherenceSlug?: string | null;
  getPowerLevel?: (userId: string | null) => number;
}): {
  hasPolicy: boolean;
  memberMatrixUserIds: string[];
  ownerMatrixUserId: string | null;
} {
  const { room, coherenceSlug, getPowerLevel } = options;
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
    { getPowerLevel },
  );
}
