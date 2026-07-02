const SIGNAL_TEAM_EVENT_KIND = 'io.hypha.signal.team.v1';

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

export function getSignalTeamMembersFromRoom(options: {
  room: {
    getLiveTimeline: () => {
      getEvents: () => Array<{
        getType: () => string;
        getContent: () => Record<string, unknown> | null;
      }>;
    };
  } | null;
  coherenceSlug?: string;
}): { hasPolicy: boolean; memberMatrixUserIds: string[] } {
  const { room, coherenceSlug } = options;
  if (!room) return { hasPolicy: false, memberMatrixUserIds: [] };
  const targetSlug = coherenceSlug?.trim() || null;
  let hasPolicy = false;
  let members: string[] = [];
  for (const event of room.getLiveTimeline().getEvents()) {
    if (event.getType() !== 'm.room.message') continue;
    const content = event.getContent();
    if (!content || typeof content !== 'object') continue;
    const msgtype =
      typeof content.msgtype === 'string' ? content.msgtype.trim() : '';
    if (msgtype !== SIGNAL_TEAM_EVENT_KIND) continue;
    const eventSlug =
      typeof content.coherenceSlug === 'string'
        ? content.coherenceSlug.trim()
        : '';
    if (targetSlug && eventSlug && eventSlug !== targetSlug) continue;
    const nextMembers = normalizeMatrixUserIds(content.memberMatrixUserIds);
    members = nextMembers;
    hasPolicy = true;
  }
  return { hasPolicy, memberMatrixUserIds: members };
}
