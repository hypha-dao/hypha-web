export type ConnectionListPerson = {
  id: number;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl?: string | null;
};

export type ConversationRow = {
  roomId: string;
  name: string;
  avatarUrl?: string;
  preview: string;
  mine: boolean;
  lastTs: number | null;
  unread: number;
  memberCount: number;
  otherUserId: string | null;
  kind: 'person' | 'group';
};

export type MemberRow<T extends ConnectionListPerson = ConnectionListPerson> = {
  person: T;
  name: string;
  avatarUrl?: string;
  preview: string;
  mine: boolean;
  lastTs: number | null;
  unread: number;
  roomId: string | null;
};

function botUserId() {
  return process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim() || null;
}

export function looksLikeHyphaBot(value: string | null | undefined) {
  return Boolean(value && /hypha[_-]bot/i.test(value));
}

export function isHyphaBot(userId: string | undefined, name?: string | null) {
  const configured = botUserId();
  if (configured && userId === configured) return true;
  const local = userId?.replace(/^@/, '').split(':')[0] ?? '';
  return looksLikeHyphaBot(local) || looksLikeHyphaBot(name);
}

export const STALE_CONNECTION_MS = 14 * 24 * 60 * 60 * 1000;
export const REACH_OUT_LIMIT = 6;
const MEET_SLOTS = 3;
const RECONNECT_SLOTS = 3;

export type SuggestedPerson = {
  id: number;
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl: string | null;
};

export type ConnectionSuggestion = {
  key: string;
  kind: 'reconnect' | 'meet';
  name: string;
  avatarUrl?: string;
  roomId: string | null;
  lastTs: number | null;
  person: SuggestedPerson;
  sharedSpaceCount: number;
  spaceTitle: string | null;
};

type SuggestionMember = {
  person: SuggestedPerson & { sharedSpaceCount?: number };
  name: string;
  avatarUrl?: string;
  roomId: string | null;
  lastTs: number | null;
};

export type NewcomerCandidate = {
  id: number;
  name: string;
  avatarUrl?: string | null;
  spaceTitle: string;
  spaceSlug: string;
  score: number;
};

function personName(person: ConnectionListPerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

function directRoomByMatrixId(rows: readonly ConversationRow[]) {
  const rooms = new Map<string, ConversationRow>();
  for (const row of rows) {
    if (row.kind !== 'person' || !row.otherUserId) continue;
    const current = rooms.get(row.otherUserId);
    if (!current || (row.lastTs ?? 0) >= (current.lastTs ?? 0)) {
      rooms.set(row.otherUserId, row);
    }
  }
  return rooms;
}

/** Members this person connects with. Signal rooms stay out of the list. */
export function memberRowsForConnections<T extends ConnectionListPerson>(
  connections: readonly T[],
  rooms: readonly ConversationRow[],
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
  selfId: number | null,
  fallback: string,
): MemberRow<T>[] {
  const direct = directRoomByMatrixId(rooms);
  return connections
    .filter((person) => person.id !== selfId)
    .map((person) => {
      const mxid = personIdToMatrixUserId[person.id];
      const room = mxid ? direct.get(mxid) : undefined;
      const name = personName(person, fallback);
      return {
        person,
        name,
        avatarUrl: person.avatarUrl || room?.avatarUrl || undefined,
        preview: room?.preview ?? '',
        mine: room?.mine ?? false,
        lastTs: room?.lastTs ?? null,
        unread: room?.unread ?? 0,
        roomId: room?.roomId ?? null,
      };
    })
    .filter(
      (row) => !isHyphaBot(personIdToMatrixUserId[row.person.id], row.name),
    )
    .sort((left, right) => {
      const byTime = (right.lastTs ?? 0) - (left.lastTs ?? 0);
      if (byTime !== 0) return byTime;
      return left.name.localeCompare(right.name);
    });
}

function bySharedThenId(left: SuggestionMember, right: SuggestionMember) {
  const shared =
    (right.person.sharedSpaceCount ?? 0) - (left.person.sharedSpaceCount ?? 0);
  if (shared !== 0) return shared;
  return left.person.id - right.person.id;
}

function fillSlots<T>(primary: T[], spare: T[], limit: number): T[] {
  const picked = primary.slice(0, limit);
  for (const item of spare) {
    if (picked.length >= limit) break;
    picked.push(item);
  }
  return picked;
}

function suggestionForMember(
  row: SuggestionMember,
  kind: ConnectionSuggestion['kind'],
): ConnectionSuggestion {
  return {
    key: `person-${row.person.id}`,
    kind,
    name: row.name,
    avatarUrl: row.avatarUrl,
    roomId: row.roomId,
    lastTs: row.lastTs,
    person: row.person,
    sharedSpaceCount: row.person.sharedSpaceCount ?? 0,
    spaceTitle: null,
  };
}

/**
 * Long time no see stays people you already connect with.
 * Worth meeting is only someone who is not in that list.
 */
export function suggestConnections(
  members: readonly SuggestionMember[],
  newcomers: readonly NewcomerCandidate[],
  now: number,
  staleMs = STALE_CONNECTION_MS,
  limit = REACH_OUT_LIMIT,
): ConnectionSuggestion[] {
  const known = new Set(members.map((row) => row.person.id));
  const fresh = newcomers
    .filter((person) => person.name.trim() && !known.has(person.id))
    .sort((left, right) => right.score - left.score || left.id - right.id);
  const seenNew = new Set<number>();
  const meet = fresh
    .filter((person) => {
      if (seenNew.has(person.id)) return false;
      seenNew.add(person.id);
      return true;
    })
    .map(
      (person): ConnectionSuggestion => ({
        key: `newcomer-${person.id}`,
        kind: 'meet',
        name: person.name.trim(),
        avatarUrl: person.avatarUrl ?? undefined,
        roomId: null,
        lastTs: null,
        person: {
          id: person.id,
          slug: null,
          name: person.name.trim(),
          surname: null,
          nickname: null,
          avatarUrl: person.avatarUrl ?? null,
        },
        sharedSpaceCount: 0,
        spaceTitle: person.spaceTitle,
      }),
    );
  const reconnect = members
    .filter((row) => row.lastTs != null && now - row.lastTs > staleMs)
    .sort((left, right) => (left.lastTs ?? 0) - (right.lastTs ?? 0))
    .map((row) => suggestionForMember(row, 'reconnect'));
  const neverWrote = members
    .filter((row) => row.lastTs == null)
    .sort(bySharedThenId)
    .map((row) => suggestionForMember(row, 'reconnect'));

  return fillSlots(
    [...meet.slice(0, MEET_SLOTS), ...reconnect.slice(0, RECONNECT_SLOTS)],
    [
      ...reconnect.slice(RECONNECT_SLOTS),
      ...neverWrote,
      ...meet.slice(MEET_SLOTS),
    ],
    limit,
  );
}
