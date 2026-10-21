import { looksLikeTechnicalMatrixDisplayName } from '../../../../core/src/matrix/matrix-member-display';
import { replacePlainTextMatrixMxidsWithLabels } from '../../../../core/src/matrix/mentions';

export type ConnectionListPerson = {
  id: number;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl?: string | null;
  slug?: string | null;
  sharedSpaceCount?: number;
};

/** Two faces on a group row, the way a Discord group shows who is in it. */
export type GroupFace = {
  name: string;
  avatarUrl?: string;
  /** Matrix user id, so a Hypha profile photo can replace an empty Matrix avatar. */
  userId?: string;
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
  /** Up to two other members, used as the group icon. */
  faces?: GroupFace[];
  /** Remembered as a group chat, even if the room was later renamed. */
  groupChat?: boolean;
  /** A signal thread that happens to have one other person. Not a private message. */
  signalThread?: boolean;
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
  /** Set on a group chat. Two faces mean the row is a group. */
  faces?: GroupFace[];
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
export const REACH_OUT_LIMIT = 12;
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

const PREVIEW_LENGTH = 48;

function truncateMessagePreview(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= PREVIEW_LENGTH) return clean;
  return `${clean.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…`;
}

function mentionName(
  matrixUserId: string,
  namesByMatrixId: ReadonlyMap<string, string> | undefined,
  labelForMxid?: (matrixUserId: string) => string,
) {
  const id = matrixUserId.trim();
  const local = id.replace(/^@/, '').split(':')[0]?.toLowerCase() ?? '';
  const raw = (
    namesByMatrixId?.get(id.toLowerCase()) ??
    namesByMatrixId?.get(local) ??
    labelForMxid?.(id) ??
    ''
  )
    .replace(/^@/, '')
    .trim();
  if (!raw || looksLikeTechnicalMatrixDisplayName(raw, id)) return '';
  return `@${raw}`;
}

/** Sidebar line. Mentions stay as Matrix ids until a real name is known. */
export function messagePreview(
  body: string,
  labelForMxid?: (matrixUserId: string) => string,
) {
  return previewLine(body, undefined, labelForMxid);
}

/**
 * Swap mention ids for people already on the list, then shorten the line.
 * Call this where profile names are known. `messagePreview` keeps the id intact
 * so a later pass can still match it.
 */
export function previewWithNames(
  preview: string,
  namesByMatrixId: ReadonlyMap<string, string>,
) {
  return previewLine(preview, namesByMatrixId);
}

function previewLine(
  body: string,
  namesByMatrixId?: ReadonlyMap<string, string>,
  labelForMxid?: (matrixUserId: string) => string,
) {
  const unwrapped = body.replace(/<(@[^>\s]+)>/g, '$1');
  const named = replacePlainTextMatrixMxidsWithLabels(unwrapped, (id) =>
    mentionName(id, namesByMatrixId, labelForMxid),
  ).replace(
    /@((?:dev|prev|prod)_privy_did_privy_[A-Za-z0-9]+)/gi,
    (token, local: string) =>
      mentionName(local, namesByMatrixId, labelForMxid) || token,
  );
  const kept = named
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>'));
  const text = (kept.at(-1) ?? named)
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, (url) => {
      try {
        return new URL(url.replace(/[),.;]+$/, '')).hostname.replace(
          /^www\./,
          '',
        );
      } catch {
        return 'link';
      }
    })
    .replace(
      /@([A-Za-z0-9._=\-/]+):[A-Za-z0-9.\-:[\]]+(?::\d+)?/g,
      (full, local: string) =>
        /privy|did_privy|^prod_|^prev_|^dev_/i.test(local) ? full : `@${local}`,
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (/privy_did_privy/i.test(text)) return text;
  return truncateMessagePreview(text);
}

const signalThreadRoomIds = new Set<string>();
const signalThreadRoomListeners = new Set<() => void>();
const SIGNAL_THREAD_ROOMS_KEY = 'hypha.signal-thread-rooms';
const DIRECT_ROOMS_KEY = 'hypha.direct-rooms';
let signalThreadRoomsLoaded = false;

function loadSignalThreadRooms() {
  if (signalThreadRoomsLoaded || typeof window === 'undefined') return;
  signalThreadRoomsLoaded = true;
  try {
    const raw = window.localStorage.getItem(SIGNAL_THREAD_ROOMS_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (typeof id === 'string' && id.trim()) {
        signalThreadRoomIds.add(id.trim());
      }
    }
  } catch {
    // Ignore a broken cache. The live timeline can still mark a signal room.
  }
}

function persistSignalThreadRooms() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SIGNAL_THREAD_ROOMS_KEY,
      JSON.stringify([...signalThreadRoomIds]),
    );
  } catch {
    // Ignore quota and private-mode failures.
  }
}

/** Rooms already known to be signal threads, including ones loaded from Hypha. */
export function rememberSignalThreadRooms(
  roomIds: Iterable<string | null | undefined>,
  options?: { quiet?: boolean },
) {
  loadSignalThreadRooms();
  let changed = false;
  for (const roomId of roomIds) {
    const id = roomId?.trim();
    if (!id || signalThreadRoomIds.has(id)) continue;
    signalThreadRoomIds.add(id);
    changed = true;
  }
  if (changed) persistSignalThreadRooms();
  if (!changed || options?.quiet) return;
  for (const listener of signalThreadRoomListeners) listener();
}

export function isRememberedSignalThreadRoom(roomId: string) {
  loadSignalThreadRooms();
  return signalThreadRoomIds.has(roomId.trim());
}

function directRoomKey(selfUserId: string, otherUserId: string) {
  return `${selfUserId.trim()}\n${otherUserId.trim()}`;
}

/** The last direct room opened with this person, including one they have not joined yet. */
export function readRememberedDirectRoom(
  selfUserId: string,
  otherUserId: string,
) {
  if (typeof window === 'undefined') return null;
  const self = selfUserId.trim();
  const other = otherUserId.trim();
  if (!self || !other) return null;
  try {
    const raw = window.localStorage.getItem(DIRECT_ROOMS_KEY);
    const map = raw ? (JSON.parse(raw) as unknown) : null;
    if (!map || typeof map !== 'object') return null;
    const roomId = (map as Record<string, unknown>)[directRoomKey(self, other)];
    return typeof roomId === 'string' && roomId.trim() ? roomId.trim() : null;
  } catch {
    return null;
  }
}

export function rememberDirectRoom(
  selfUserId: string,
  otherUserId: string,
  roomId: string,
) {
  if (typeof window === 'undefined') return;
  const self = selfUserId.trim();
  const other = otherUserId.trim();
  const id = roomId.trim();
  if (!self || !other || !id) return;
  try {
    const raw = window.localStorage.getItem(DIRECT_ROOMS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const map =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, string>)
        : {};
    map[directRoomKey(self, other)] = id;
    window.localStorage.setItem(DIRECT_ROOMS_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota and private-mode failures.
  }
}

export function subscribeSignalThreadRooms(listener: () => void) {
  signalThreadRoomListeners.add(listener);
  return () => {
    signalThreadRoomListeners.delete(listener);
  };
}

export function eventContentIsSignalThread(
  content: Record<string, unknown> | null | undefined,
): boolean {
  if (!content) return false;
  const msgtype =
    typeof content.msgtype === 'string' ? content.msgtype.trim() : '';
  if (
    msgtype === 'io.hypha.signal.team.v1' ||
    msgtype === 'io.hypha.signal.team.request.v1'
  ) {
    return true;
  }
  const body = typeof content.body === 'string' ? content.body.trim() : '';
  if (
    body.startsWith('[hypha:signal-team]') ||
    body.startsWith('[hypha:signal-team-request]')
  ) {
    return true;
  }
  const slug =
    typeof content.coherenceSlug === 'string'
      ? content.coherenceSlug.trim()
      : '';
  return slug.length > 0;
}

function directRoomByMatrixId(rows: readonly ConversationRow[]) {
  const rooms = new Map<string, ConversationRow>();
  for (const row of rows) {
    if (row.signalThread || row.kind !== 'person' || !row.otherUserId) continue;
    const key = row.otherUserId.toLowerCase();
    const current = rooms.get(key);
    if (!current || (row.lastTs ?? 0) >= (current.lastTs ?? 0)) {
      rooms.set(key, row);
    }
  }
  return rooms;
}

/**
 * Direct rooms that lost the one-conversation-per-person pick.
 * Their history stays, but they are not the conversation the badge should count.
 */
export function supersededDirectRoomIds(rows: readonly ConversationRow[]) {
  const keep = new Set<string>();
  for (const row of directRoomByMatrixId(rows).values()) keep.add(row.roomId);
  const losers: string[] = [];
  for (const row of rows) {
    if (row.signalThread || row.kind !== 'person' || !row.otherUserId) continue;
    if (keep.has(row.roomId)) continue;
    losers.push(row.roomId);
  }
  return losers;
}

/**
 * Unread 1:1 rooms that do not map onto the loaded member directory yet.
 * Keeps the Chat tab badge and the people list in step.
 */
export function unreadRoomsMissingFromMembers<T extends ConnectionListPerson>(
  rooms: readonly ConversationRow[],
  members: readonly MemberRow<T>[],
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
): MemberRow<T>[] {
  const knownMxids = new Set(
    Object.values(personIdToMatrixUserId)
      .filter((id): id is string => Boolean(id))
      .map((id) => id.toLowerCase()),
  );
  const knownRooms = new Set(
    members
      .map((member) => member.roomId)
      .filter((id): id is string => Boolean(id)),
  );
  const extras: MemberRow<T>[] = [];
  let syntheticId = -1;
  for (const room of rooms) {
    if (room.signalThread || room.kind !== 'person' || room.unread <= 0) {
      continue;
    }
    if (knownRooms.has(room.roomId)) continue;
    if (room.otherUserId && knownMxids.has(room.otherUserId.toLowerCase())) {
      continue;
    }
    extras.push({
      person: {
        id: syntheticId,
        name: room.name || null,
        surname: null,
        nickname: null,
        avatarUrl: room.avatarUrl ?? null,
        slug: null,
        sharedSpaceCount: 0,
      } as T,
      name: room.name.trim() || room.otherUserId || room.roomId,
      avatarUrl: room.avatarUrl,
      preview: room.preview,
      mine: room.mine,
      lastTs: room.lastTs,
      unread: room.unread,
      roomId: room.roomId,
    });
    syntheticId -= 1;
  }
  return extras;
}

function groupPersonId(roomId: string) {
  let hash = 0;
  for (let index = 0; index < roomId.length; index += 1) {
    hash = (Math.imul(hash, 31) + roomId.charCodeAt(index)) | 0;
  }
  const id = -Math.abs(hash);
  return id === 0 ? -1 : id;
}

/** Prefer the Hypha profile photo and name when Matrix only has an id. */
export function facesWithProfiles(
  faces: readonly GroupFace[] | undefined,
  profiles: ReadonlyMap<string, { name: string; avatarUrl?: string }>,
): GroupFace[] | undefined {
  if (!faces || faces.length === 0) return faces ? [...faces] : undefined;
  return faces.map((face) => {
    const profile = face.userId
      ? profiles.get(face.userId.toLowerCase())
      : undefined;
    if (!profile) return face;
    const name = profile.name.trim();
    return {
      ...face,
      name: name || face.name,
      avatarUrl: profile.avatarUrl || face.avatarUrl,
    };
  });
}

function twoGroupFaces(room: ConversationRow): GroupFace[] {
  const faces = [...(room.faces ?? [])].slice(0, 2);
  if (faces.length >= 2) return faces;
  const names = room.name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const name of names) {
    if (faces.length >= 2) break;
    if (faces.some((face) => face.name === name)) continue;
    faces.push({ name });
  }
  return faces.slice(0, 2);
}

const groupChatRoomIds = new Set<string>();
const GROUP_CHAT_ROOMS_KEY = 'hypha.group-chat-rooms';
let groupChatRoomsLoaded = false;

function loadGroupChatRooms() {
  if (groupChatRoomsLoaded || typeof window === 'undefined') return;
  groupChatRoomsLoaded = true;
  try {
    const raw = window.localStorage.getItem(GROUP_CHAT_ROOMS_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (typeof id === 'string' && id.trim()) {
        groupChatRoomIds.add(id.trim());
      }
    }
  } catch {
    // Ignore a broken cache. A comma-separated room title still marks a group chat.
  }
}

function persistGroupChatRooms() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      GROUP_CHAT_ROOMS_KEY,
      JSON.stringify([...groupChatRoomIds]),
    );
  } catch {
    // Ignore quota and private-mode failures.
  }
}

/** Rooms this member started as a group chat, so they stay in People around. */
export function rememberGroupChatRooms(
  roomIds: Iterable<string | null | undefined>,
) {
  loadGroupChatRooms();
  let changed = false;
  for (const roomId of roomIds) {
    const id = roomId?.trim();
    if (!id || groupChatRoomIds.has(id)) continue;
    groupChatRoomIds.add(id);
    changed = true;
  }
  if (changed) persistGroupChatRooms();
}

export function isRememberedGroupChatRoom(roomId: string) {
  loadGroupChatRooms();
  return groupChatRoomIds.has(roomId.trim());
}

const GROUP_CHAT_MEMBERS_KEY = 'hypha.group-chat-members';

function readGroupChatMembers(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GROUP_CHAT_MEMBERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const members: Record<string, string[]> = {};
    for (const [roomId, ids] of Object.entries(parsed)) {
      if (!roomId.trim() || !Array.isArray(ids)) continue;
      const matrixUserIds = ids.filter(
        (id): id is string => typeof id === 'string' && Boolean(id.trim()),
      );
      if (matrixUserIds.length > 0) members[roomId.trim()] = matrixUserIds;
    }
    return members;
  } catch {
    return {};
  }
}

/** People chosen for a group, so a later visit can join anyone still missing. */
export function rememberGroupChatMembers(
  roomId: string,
  matrixUserIds: readonly string[],
) {
  if (typeof window === 'undefined') return;
  const id = roomId.trim();
  const ids = [
    ...new Set(matrixUserIds.map((userId) => userId.trim()).filter(Boolean)),
  ];
  if (!id || ids.length === 0) return;
  try {
    const members = readGroupChatMembers();
    members[id] = ids;
    window.localStorage.setItem(
      GROUP_CHAT_MEMBERS_KEY,
      JSON.stringify(members),
    );
  } catch {
    // Ignore quota and private-mode failures.
  }
}

export function rememberedGroupChatMemberIds(roomId: string): string[] {
  return readGroupChatMembers()[roomId.trim()] ?? [];
}

/**
 * A private group chat, not a space channel.
 * Space rooms share the Matrix account but are named for the space.
 * A group chat is titled with the people in it, or remembered from here.
 */
export function isPeopleListGroup(room: ConversationRow) {
  if (room.kind !== 'group' || room.signalThread) return false;
  if (room.groupChat || isRememberedGroupChatRoom(room.roomId)) return true;
  return room.name.includes(',');
}

/** Group chats mixed into the people list. One row per room, with two faces. */
export function groupRowsForConnections<T extends ConnectionListPerson>(
  rooms: readonly ConversationRow[],
  fallback: string,
): MemberRow<T>[] {
  return rooms
    .filter((room) => isPeopleListGroup(room))
    .map((room) => {
      const faces = twoGroupFaces(room);
      const name = room.name.trim() || fallback;
      return {
        person: {
          id: groupPersonId(room.roomId),
          name,
          surname: null,
          nickname: null,
          avatarUrl: null,
          slug: null,
          sharedSpaceCount: 0,
        } as T,
        name,
        avatarUrl: room.avatarUrl,
        faces,
        preview: room.preview,
        mine: room.mine,
        lastTs: room.lastTs,
        unread: room.unread,
        roomId: room.roomId,
      };
    });
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
      const room = mxid ? direct.get(mxid.toLowerCase()) : undefined;
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

/** A room with no readable line is not a conversation yet. */
export function connectionActivityTs(
  lastTs: number | null | undefined,
  preview: string | null | undefined,
) {
  if (!preview?.trim()) return null;
  return lastTs ?? null;
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
