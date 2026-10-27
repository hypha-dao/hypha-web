import {
  isHyphaBotMatrixIdentity,
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
  pickUserVisibleMemberLabel,
  uniqueCanonicalPrivySubsFromMxids,
  visibleMatrixMemberName,
} from '../../../../core/src/matrix/matrix-member-display';
import { replacePlainTextMatrixMxidsWithLabels } from '../../../../core/src/matrix/mentions';
import {
  countCommaSeparatedNames,
  peopleConversationKindForListing,
} from '../../../../core/src/matrix/group-room';
import { HYPHA_ROOM_TYPES } from '../../../../core/src/matrix/room-types';
import type { InboxPlace } from './messages-inbox';

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
  /** Matrix user id of the person who sent the preview, when one is loaded. */
  senderUserId?: string | null;
  lastTs: number | null;
  unread: number;
  memberCount: number;
  otherUserId: string | null;
  kind: 'person' | 'group';
  /** `m.room.create` type, when the room was created with one. */
  roomType?: string | null;
  /** Up to two other members, used as the group icon. */
  faces?: GroupFace[];
  /** Remembered as a group chat, even if the room was later renamed. */
  groupChat?: boolean;
  /** A signal thread that happens to have one other person. Not a private message. */
  signalThread?: boolean;
  /** Hidden from Messages; still listed under Archived. */
  archived?: boolean;
  /** All other members, so search can match more than the two faces. */
  searchMembers?: {
    name: string;
    nickname?: string | null;
    slug?: string | null;
    userId?: string;
  }[];
};

export type MemberRow<T extends ConnectionListPerson = ConnectionListPerson> = {
  person: T;
  name: string;
  avatarUrl?: string;
  preview: string;
  mine: boolean;
  /** Matrix user id of the person who sent the preview. */
  senderUserId?: string | null;
  /** First name for a shared channel. Never a Privy id. */
  senderName?: string;
  lastTs: number | null;
  unread: number;
  roomId: string | null;
  /**
   * True until a human display name is known. Never put a raw Privy / Matrix
   * id in `name` while this is set — the row shows a skeleton instead.
   */
  titlePending?: boolean;
  /** Set on a group chat. Two faces mean the row is a group. */
  faces?: GroupFace[];
  /** Hidden from Messages; still listed under Archived. */
  archived?: boolean;
  /** All other members, so search can match more than the two faces. */
  searchMembers?: {
    name: string;
    nickname?: string | null;
    slug?: string | null;
    userId?: string;
  }[];
  /**
   * Where this existing conversation sits in the messages inbox.
   * Absent on older rows; the list treats those as a direct chat or a group.
   */
  inbox?: InboxPlace;
};

export function looksLikeHyphaBot(value: string | null | undefined) {
  return Boolean(value && /hypha[_-]bot/i.test(value));
}

export function isHyphaBot(userId: string | undefined, name?: string | null) {
  return isHyphaBotMatrixIdentity(userId, name);
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

/** First label that is safe to show as a Messages row title. Never an id. */
export function conversationDisplayName(
  matrixUserId: string | null | undefined,
  ...candidates: Array<string | null | undefined>
): string | null {
  const mxid = matrixUserId?.trim() ?? '';
  if (mxid) {
    return pickUserVisibleMemberLabel(mxid, ...candidates);
  }
  for (const candidate of candidates) {
    const label = candidate?.trim();
    if (!label) continue;
    if (isHyphaBotMatrixIdentity('', label)) continue;
    if (!looksLikeTechnicalMatrixDisplayName(label, '')) return label;
  }
  return null;
}

export function isUnresolvedConversationTitle(
  name: string | null | undefined,
  matrixUserId?: string | null,
) {
  const label = name?.trim() ?? '';
  if (!label) return true;
  return looksLikeTechnicalMatrixDisplayName(label, matrixUserId?.trim() ?? '');
}

export type ResolvedPeerTitle = {
  name: string;
  titlePending: boolean;
};

/** Title for a DM row: a real name, or pending (never a raw Privy / Matrix id). */
export function resolvePeerRowTitle(
  room: Pick<ConversationRow, 'name' | 'otherUserId' | 'roomId'>,
  person?: ConnectionListPerson,
  fallback = '',
): ResolvedPeerTitle {
  const visible = conversationDisplayName(
    room.otherUserId,
    person ? personName(person, '') : '',
    room.name,
  );
  if (visible) return { name: visible, titlePending: false };
  const placeholder = fallback.trim();
  if (placeholder && !isUnresolvedConversationTitle(placeholder)) {
    return { name: placeholder, titlePending: false };
  }
  return { name: '', titlePending: true };
}

export type PeerProfileBySub = {
  id?: number;
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  slug?: string | null;
  avatarUrl?: string | null;
};

/** Privy subs for DM peers and group members — fetch these up front. */
export function conversationPeerSubs(
  rows: readonly Pick<
    ConversationRow,
    'otherUserId' | 'searchMembers' | 'senderUserId'
  >[],
): string[] {
  return uniqueCanonicalPrivySubsFromMxids(
    rows.flatMap((row) => [
      row.otherUserId,
      row.senderUserId,
      ...(row.searchMembers ?? []).map((member) => member.userId),
    ]),
  );
}

/**
 * First name for a shared-channel preview. Profile first name wins.
 * A Privy id, or a Matrix label that is one, is left blank.
 */
export function senderFirstName({
  profileName,
  profileNickname,
  memberName,
  matrixLabel,
  senderUserId,
}: {
  profileName?: string | null;
  profileNickname?: string | null;
  memberName?: string | null;
  matrixLabel?: string | null;
  senderUserId?: string | null;
}): string {
  const id = senderUserId?.trim() ?? '';
  const profile = profileName?.trim() ?? '';
  if (profile && !looksLikeTechnicalMatrixDisplayName(profile, id || profile)) {
    return profile;
  }
  const nick = profileNickname?.trim() ?? '';
  if (nick && !looksLikeTechnicalMatrixDisplayName(nick, id || nick)) {
    return nick.split(/\s+/)[0] ?? '';
  }
  for (const label of [memberName, matrixLabel]) {
    const clean = label?.trim() ?? '';
    if (!clean || looksLikeTechnicalMatrixDisplayName(clean, id || clean)) {
      continue;
    }
    const first = clean.split(/\s+/)[0] ?? '';
    if (!first || /privy/i.test(first)) continue;
    return first;
  }
  return '';
}

/**
 * Overlay Hypha profiles onto DM rows whose Matrix title is still a raw id.
 * While profiles are loading the title stays pending (skeleton), never the id.
 */
export function applyResolvedPeerTitles<T extends ConnectionListPerson>(
  members: readonly MemberRow<T>[],
  rooms: readonly ConversationRow[],
  peopleBySub: ReadonlyMap<string, PeerProfileBySub>,
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
  options?: {
    loading?: boolean;
    pendingSubs?: ReadonlySet<string>;
    fallback?: string;
    hideUnresolved?: boolean;
  },
): MemberRow<T>[] {
  const otherByRoom = new Map<string, string>();
  for (const room of rooms) {
    if (room.otherUserId?.trim()) {
      otherByRoom.set(room.roomId, room.otherUserId.trim());
    }
  }
  const fallback = options?.fallback?.trim() ?? '';
  return members.map((row) => {
    if (row.faces && row.faces.length > 0) return row;
    const mxid =
      (row.person.id > 0
        ? personIdToMatrixUserId[row.person.id]?.trim()
        : undefined) ||
      (row.roomId ? otherByRoom.get(row.roomId) : undefined) ||
      '';
    const fromRow = conversationDisplayName(
      mxid,
      personName(row.person, ''),
      row.name,
    );
    if (fromRow) return { ...row, name: fromRow, titlePending: false };
    const sub = mxid ? matrixUserIdToCanonicalPrivySub(mxid) : null;
    const fetched = sub ? peopleBySub.get(sub) : undefined;
    const fetchedName = fetched
      ? [fetched.name, fetched.surname].filter(Boolean).join(' ').trim() ||
        fetched.nickname?.trim() ||
        ''
      : '';
    const fetchedId =
      fetched?.id && fetched.id > 0 ? fetched.id : row.person.id;
    if (fetchedName && !isUnresolvedConversationTitle(fetchedName, mxid)) {
      return {
        ...row,
        name: fetchedName,
        titlePending: false,
        avatarUrl: fetched?.avatarUrl || row.avatarUrl,
        person: {
          ...row.person,
          id: fetchedId,
          name: fetched?.name ?? row.person.name,
          surname: fetched?.surname ?? row.person.surname,
          nickname: fetched?.nickname ?? row.person.nickname,
          slug: fetched?.slug ?? row.person.slug,
          avatarUrl: fetched?.avatarUrl ?? row.person.avatarUrl,
        },
      };
    }
    const rowLoading = options?.pendingSubs
      ? Boolean(sub && options.pendingSubs.has(sub))
      : Boolean(options?.loading);
    if (rowLoading) {
      return { ...row, name: '', titlePending: true };
    }
    if (
      options?.hideUnresolved ||
      !fallback ||
      isUnresolvedConversationTitle(fallback)
    ) {
      return { ...row, name: '', titlePending: true };
    }
    return { ...row, name: fallback, titlePending: false };
  });
}

/** Drop DM rows whose title never resolved. Skeletons stay while profiles load. */
export function visibleMemberRowsAfterTitleResolve<
  T extends ConnectionListPerson,
>(rows: readonly MemberRow<T>[], loading: boolean): MemberRow<T>[] {
  if (loading) return [...rows];
  return rows.filter((row) => !row.titlePending);
}

export type MessagesPeopleListReadyInput = {
  isMatrixAvailable: boolean;
  isConnecting: boolean;
  /** Matrix has reached Prepared/Syncing. Not enough on its own — Syncing can be empty. */
  synced: boolean;
  /**
   * First /sync finished (`Prepared` or `isInitialSyncComplete`). Without this,
   * the 12-person directory paints as PEOPLE AROUND before rooms exist.
   */
  initialSyncComplete: boolean;
  /** Joined rooms still waiting for a conversation summary. */
  rowsPending: boolean;
  /** Intelligence fetch finished (or there is no JWT to fetch). */
  homeLoaded: boolean;
  /** Person → Matrix ids still loading, so DMs cannot attach to directory rows. */
  matrixIdsLoading: boolean;
  /** Peer profiles still loading; unresolved DMs would drop when this settles. */
  peopleBySubLoading: boolean;
};

/**
 * The Messages people list is safe to paint. Until then the directory (or a
 * partial Matrix store) would flash the wrong set of people.
 *
 * Matrix unavailable and not connecting is "ready" so the empty/unavailable
 * copy can show. Callers latch this so a later room pump does not hide the list.
 */
export function messagesPeopleListReady(
  input: MessagesPeopleListReadyInput,
): boolean {
  if (!input.isMatrixAvailable) return !input.isConnecting;
  return (
    input.synced &&
    input.initialSyncComplete &&
    !input.rowsPending &&
    input.homeLoaded &&
    !input.matrixIdsLoading &&
    !input.peopleBySubLoading
  );
}

/** Union directory pages / search hits by person id. Synthetics stay out. */
export function mergeDirectoryPeople<T extends { id: number }>(
  ...lists: Array<readonly T[] | null | undefined>
): T[] {
  const byId = new Map<number, T>();
  for (const list of lists) {
    for (const person of list ?? []) {
      if (person.id > 0) byId.set(person.id, person);
    }
  }
  return [...byId.values()];
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

const boundChatRoomIds = new Set<string>();
const BOUND_CHAT_ROOMS_KEY = 'hypha.bound-chat-rooms';
let boundChatRoomsLoaded = false;

function loadBoundChatRooms() {
  if (boundChatRoomsLoaded || typeof window === 'undefined') return;
  boundChatRoomsLoaded = true;
  try {
    const raw = window.localStorage.getItem(BOUND_CHAT_ROOMS_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (typeof id === 'string' && id.trim()) {
        boundChatRoomIds.add(id.trim());
      }
    }
  } catch {
    // Ignore a broken cache. The next lookup can refill it.
  }
}

function persistBoundChatRooms() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      BOUND_CHAT_ROOMS_KEY,
      JSON.stringify([...boundChatRoomIds]),
    );
  } catch {
    // Ignore quota and private-mode failures.
  }
}

/** Space member rooms and signal threads, including archived signals. */
export function rememberBoundChatRooms(
  roomIds: Iterable<string | null | undefined>,
) {
  loadBoundChatRooms();
  let changed = false;
  for (const roomId of roomIds) {
    const id = roomId?.trim();
    if (!id || boundChatRoomIds.has(id)) continue;
    boundChatRoomIds.add(id);
    changed = true;
  }
  if (changed) persistBoundChatRooms();
}

export function isRememberedBoundChatRoom(roomId: string) {
  loadBoundChatRooms();
  return boundChatRoomIds.has(roomId.trim());
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

const PERSON_DIRECT_ROOMS_KEY = 'hypha.person-direct-rooms';

function readPersonDirectRoomMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PERSON_DIRECT_ROOMS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const map: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) map[key] = value.trim();
    }
    return map;
  } catch {
    return {};
  }
}

/** Last opened DM for this Hypha person, so a refresh can reopen it without mxid. */
export function readRememberedPersonDirectRoom(personId: number) {
  if (!Number.isFinite(personId) || personId <= 0) return null;
  return readPersonDirectRoomMap()[String(personId)]?.trim() || null;
}

/** Reuse a person-keyed room only when its joined peer is the current MXID. */
export function rememberedPersonRoomIsCurrentPeer(
  currentMxid: string | null | undefined,
  joinedPeerIds: readonly string[],
): boolean {
  const mxid = currentMxid?.trim().toLowerCase();
  if (!mxid) return false;
  return joinedPeerIds.some((id) => id.trim().toLowerCase() === mxid);
}

export function rememberPersonDirectRoom(personId: number, roomId: string) {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(personId) || personId <= 0) return;
  const id = roomId.trim();
  if (!id) return;
  try {
    const map = readPersonDirectRoomMap();
    map[String(personId)] = id;
    window.localStorage.setItem(PERSON_DIRECT_ROOMS_KEY, JSON.stringify(map));
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

function preferDirectRoom(current: ConversationRow, next: ConversationRow) {
  const currentTyped = isTypedDmConversation(current);
  const nextTyped = isTypedDmConversation(next);
  if (currentTyped !== nextTyped) return nextTyped ? next : current;
  return (next.lastTs ?? 0) >= (current.lastTs ?? 0) ? next : current;
}

function directRoomByMatrixId(rows: readonly ConversationRow[]) {
  const rooms = new Map<string, ConversationRow>();
  for (const row of rows) {
    if (row.signalThread || row.kind !== 'person' || !row.otherUserId) continue;
    const key = row.otherUserId.toLowerCase();
    const current = rooms.get(key);
    rooms.set(key, current ? preferDirectRoom(current, row) : row);
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

export type DirectPairRoomHint = {
  roomId: string;
  otherUserId: string;
  lastTs: number;
};

/**
 * Live Matrix rooms that look like 1:1 DMs (one human other, not a signal
 * thread). Used when conversation-row cache is incomplete so an older Gerardo
 * room still gets marked read.
 */
export function collectDirectPairRoomHints(
  rooms: readonly {
    roomId: string;
    membership: string;
    lastTs: number;
    otherUserIds: readonly string[];
    signalThread?: boolean;
  }[],
): DirectPairRoomHint[] {
  const hints: DirectPairRoomHint[] = [];
  for (const room of rooms) {
    if (room.membership !== 'join') continue;
    if (room.signalThread) continue;
    if (room.otherUserIds.length !== 1) continue;
    const otherUserId = room.otherUserIds[0];
    if (!otherUserId) continue;
    hints.push({
      roomId: room.roomId,
      otherUserId,
      lastTs: room.lastTs,
    });
  }
  return hints;
}

/**
 * Older pair rooms once a later (or remembered) room exists for the same person.
 */
export function orphanedDirectRoomIds(
  hints: readonly DirectPairRoomHint[],
  rememberedRoomIdByOther?: ReadonlyMap<string, string>,
) {
  const byOther = new Map<string, DirectPairRoomHint[]>();
  for (const hint of hints) {
    const key = hint.otherUserId.toLowerCase();
    const bucket = byOther.get(key) ?? [];
    bucket.push(hint);
    byOther.set(key, bucket);
  }
  const orphans: string[] = [];
  for (const [otherKey, bucket] of byOther) {
    if (bucket.length < 2) continue;
    const remembered = rememberedRoomIdByOther?.get(otherKey);
    const keep =
      (remembered &&
        bucket.find((room) => room.roomId === remembered)?.roomId) ||
      [...bucket].sort((a, b) => b.lastTs - a.lastTs)[0]?.roomId;
    if (!keep) continue;
    for (const room of bucket) {
      if (room.roomId !== keep) orphans.push(room.roomId);
    }
  }
  return orphans;
}

function conversationRoomType(row: { roomType?: string | null }) {
  return row.roomType?.trim() || null;
}

export function isTypedDmConversation(row: ConversationRow) {
  return conversationRoomType(row) === HYPHA_ROOM_TYPES.dm;
}

function pairPeerIds(row: ConversationRow): string[] {
  if (row.otherUserId?.trim()) return [row.otherUserId.trim().toLowerCase()];
  const fromMembers = (row.searchMembers ?? [])
    .map((member) => member.userId?.trim().toLowerCase())
    .filter((id): id is string => Boolean(id));
  if (fromMembers.length === 1) return fromMembers;
  return [];
}

/**
 * Leftover 1:1 / 2-person rooms that are not `io.hypha.room.dm|group`.
 * A raw Privy id in `m.room.name` or a stale `kind=person` snapshot used to
 * sneak these past the typed-DM filter.
 */
export function isLegacyUntypedPairConversation(row: ConversationRow): boolean {
  if (row.signalThread) return false;
  const type = conversationRoomType(row);
  if (type === HYPHA_ROOM_TYPES.dm || type === HYPHA_ROOM_TYPES.group) {
    return false;
  }
  if (type?.startsWith('io.hypha.room.')) return false;
  if (countCommaSeparatedNames(row.name) > 2) return false;
  if ((row.memberCount ?? 0) > 2) return false;
  if (row.kind === 'person') return true;
  if (
    looksLikeTechnicalMatrixDisplayName(row.name, row.otherUserId ?? row.roomId)
  ) {
    return true;
  }
  return Boolean(row.otherUserId?.trim()) || (row.memberCount ?? 0) === 2;
}

/**
 * Untyped pair rooms whose peer already has a typed DM, plus raw-id leftovers.
 * 3-name / 3+ member untyped groups stay listed.
 */
export function hiddenLegacyPairRoomIds(
  rows: readonly ConversationRow[],
): string[] {
  const typedPeers = new Set<string>();
  for (const row of rows) {
    if (!isTypedDmConversation(row) || !row.otherUserId?.trim()) continue;
    typedPeers.add(row.otherUserId.trim().toLowerCase());
  }
  const hidden: string[] = [];
  for (const row of rows) {
    if (!isLegacyUntypedPairConversation(row)) continue;
    if (row.kind === 'person') {
      hidden.push(row.roomId);
      continue;
    }
    if (
      looksLikeTechnicalMatrixDisplayName(
        row.name,
        row.otherUserId ?? row.roomId,
      )
    ) {
      hidden.push(row.roomId);
      continue;
    }
    if (pairPeerIds(row).some((id) => typedPeers.has(id))) {
      hidden.push(row.roomId);
    }
  }
  return hidden;
}

/**
 * Same rooms the Messages tab lists (search ignored). Archived groups, signal
 * threads, and anything that is not a typed DM or a People-Around group stay
 * out so the nav badge cannot count a row the list does not show.
 */
export function isMessagesVisibleConversation(row: ConversationRow): boolean {
  if (row.archived || row.signalThread) return false;
  if (row.kind === 'person') return isTypedDmConversation(row);
  if (row.kind === 'group') return isPeopleListGroup(row);
  return false;
}

/** Cached rows that would render on Messages (not Archived, not search). */
export function messagesVisibleConversationRows(
  rows: readonly ConversationRow[],
): ConversationRow[] {
  const hidden = new Set(hiddenLegacyPairRoomIds(rows));
  return rows.filter(
    (row) => isMessagesVisibleConversation(row) && !hidden.has(row.roomId),
  );
}

/**
 * Messages tab total: unread on the filtered, visible list only. Earlier pair
 * rooms and rows the list hides (archived, legacy untyped, signal) stay out
 * even when Matrix still reports them unread.
 */
export function conversationUnreadTotal(
  rows: readonly ConversationRow[],
  extraOrphanRoomIds?: readonly string[],
) {
  const losers = new Set([
    ...supersededDirectRoomIds(rows),
    ...(extraOrphanRoomIds ?? []),
  ]);
  let total = 0;
  for (const row of messagesVisibleConversationRows(rows)) {
    if (losers.has(row.roomId)) continue;
    total += row.unread;
  }
  return total;
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
  const superseded = new Set(supersededDirectRoomIds(rooms));
  const hiddenPairs = new Set(hiddenLegacyPairRoomIds(rooms));
  const extras: MemberRow<T>[] = [];
  for (const room of rooms) {
    if (room.signalThread || room.kind !== 'person' || room.unread <= 0) {
      continue;
    }
    if (!isTypedDmConversation(room) || hiddenPairs.has(room.roomId)) {
      continue;
    }
    if (superseded.has(room.roomId)) continue;
    if (knownRooms.has(room.roomId)) continue;
    if (room.otherUserId && knownMxids.has(room.otherUserId.toLowerCase())) {
      continue;
    }
    const title = resolvePeerRowTitle(room);
    extras.push({
      person: {
        id: groupPersonId(room.roomId),
        name: title.name || null,
        surname: null,
        nickname: null,
        avatarUrl: room.avatarUrl ?? null,
        slug: null,
        sharedSpaceCount: 0,
      } as T,
      name: title.name,
      titlePending: title.titlePending,
      avatarUrl: room.avatarUrl,
      preview: room.preview,
      mine: room.mine,
      lastTs: room.lastTs,
      unread: room.unread,
      roomId: room.roomId,
    });
  }
  return extras;
}

function isTypedDirectPersonRoom(room: ConversationRow) {
  if (room.signalThread || room.kind !== 'person') return false;
  // Person rows come from `io.hypha.room.dm` only. A missing, stale, or odd
  // type used to pass (`!room.roomType`) and leaked leftover 1:1s — including
  // rooms whose `m.room.name` is a raw Privy id.
  return isTypedDmConversation(room);
}

function memberRowFromPersonRoom<T extends ConnectionListPerson>(
  room: ConversationRow,
  person: T,
  name: string,
): MemberRow<T> {
  return {
    person,
    name,
    avatarUrl: person.avatarUrl || room.avatarUrl || undefined,
    preview: room.preview,
    mine: room.mine,
    lastTs: room.lastTs,
    unread: room.unread,
    roomId: room.roomId,
  };
}

function directoryPersonForMxid<T extends ConnectionListPerson>(
  mxid: string,
  personByMxid: ReadonlyMap<string, T>,
  directoryById: ReadonlyMap<number, T>,
  peopleBySub?: ReadonlyMap<string, PeerProfileBySub>,
): T | undefined {
  const known = personByMxid.get(mxid.toLowerCase());
  if (known) return known;
  const sub = matrixUserIdToCanonicalPrivySub(mxid);
  const fetchedId = sub ? peopleBySub?.get(sub)?.id : undefined;
  if (fetchedId && fetchedId > 0) return directoryById.get(fetchedId);
  return undefined;
}

function uniqueDirectoryPersonByName<T extends ConnectionListPerson>(
  directoryById: ReadonlyMap<number, T>,
  roomName: string,
  usedPersonIds: ReadonlySet<number>,
  fallback: string,
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
  roomMxid?: string | null,
): T | undefined {
  const needle = roomName.trim().toLowerCase();
  if (!needle || looksLikeTechnicalMatrixDisplayName(roomName, '')) {
    return undefined;
  }
  const matches: T[] = [];
  for (const person of directoryById.values()) {
    if (personName(person, fallback).trim().toLowerCase() === needle) {
      matches.push(person);
    }
  }
  // Uniqueness is across the full directory. usedPersonIds must not make an
  // ambiguous same-name pair look unique.
  if (matches.length !== 1) return undefined;
  const person = matches[0];
  if (!person || usedPersonIds.has(person.id)) return undefined;
  const known = personIdToMatrixUserId[person.id]?.trim().toLowerCase();
  const peer = roomMxid?.trim().toLowerCase();
  if (known && peer && known !== peer) return undefined;
  return person;
}

/**
 * Person rows for Messages: one row per DM-typed room, then directory people
 * who do not yet have a room. Incoming DMs appear even when the sender shares
 * no space. Legacy untyped pair rooms never become a person row.
 */
export function personRowsFromDmRooms<T extends ConnectionListPerson>(
  connections: readonly T[],
  rooms: readonly ConversationRow[],
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
  selfId: number | null,
  fallback: string,
  profiles?: readonly T[],
  peopleBySub?: ReadonlyMap<string, PeerProfileBySub>,
): MemberRow<T>[] {
  const directory = profiles ?? connections;
  const personByMxid = new Map<string, T>();
  const directoryById = new Map<number, T>();
  for (const person of directory) {
    if (person.id === selfId) continue;
    if (person.id > 0) directoryById.set(person.id, person);
    const mxid = personIdToMatrixUserId[person.id]?.trim();
    if (mxid) personByMxid.set(mxid.toLowerCase(), person);
  }
  const superseded = new Set(supersededDirectRoomIds(rooms));
  const hiddenPairs = new Set(hiddenLegacyPairRoomIds(rooms));
  const usedMxids = new Set<string>();
  const usedRoomIds = new Set<string>();
  const usedPersonIds = new Set<number>();
  const fromRooms: MemberRow<T>[] = [];
  const typedPeerHasHumanName = new Set<string>();
  for (const room of rooms) {
    if (
      !isTypedDirectPersonRoom(room) ||
      hiddenPairs.has(room.roomId) ||
      superseded.has(room.roomId)
    )
      continue;
    const mxid = room.otherUserId?.trim().toLowerCase();
    if (
      mxid &&
      !looksLikeTechnicalMatrixDisplayName(room.name, room.otherUserId ?? '')
    ) {
      typedPeerHasHumanName.add(mxid);
    }
  }

  for (const room of rooms) {
    if (!isTypedDirectPersonRoom(room)) continue;
    if (superseded.has(room.roomId) || hiddenPairs.has(room.roomId)) continue;
    const mxid = room.otherUserId?.trim().toLowerCase();
    if (mxid && usedMxids.has(mxid)) continue;
    if (usedRoomIds.has(room.roomId)) continue;
    const technicalName = looksLikeTechnicalMatrixDisplayName(
      room.name,
      room.otherUserId ?? room.roomId,
    );
    if (technicalName && mxid && typedPeerHasHumanName.has(mxid)) {
      continue;
    }
    const person =
      (mxid
        ? directoryPersonForMxid(mxid, personByMxid, directoryById, peopleBySub)
        : undefined) ??
      uniqueDirectoryPersonByName(
        directoryById,
        room.name,
        usedPersonIds,
        fallback,
        personIdToMatrixUserId,
        mxid,
      );
    if (person) {
      if (
        isHyphaBot(personIdToMatrixUserId[person.id], personName(person, ''))
      ) {
        continue;
      }
      fromRooms.push(
        memberRowFromPersonRoom(room, person, personName(person, fallback)),
      );
      if (person.id > 0) usedPersonIds.add(person.id);
    } else {
      if (technicalName && !mxid) continue;
      const title = resolvePeerRowTitle(room);
      fromRooms.push({
        person: {
          id: groupPersonId(room.roomId),
          name: title.name || null,
          surname: null,
          nickname: null,
          avatarUrl: room.avatarUrl ?? null,
          slug: null,
          sharedSpaceCount: 0,
        } as T,
        name: title.name,
        titlePending: title.titlePending,
        avatarUrl: room.avatarUrl,
        preview: room.preview,
        mine: room.mine,
        lastTs: room.lastTs,
        unread: room.unread,
        roomId: room.roomId,
      });
    }
    if (mxid) usedMxids.add(mxid);
    usedRoomIds.add(room.roomId);
  }

  const withoutRoom: MemberRow<T>[] = [];
  for (const person of connections) {
    if (person.id === selfId) continue;
    if (person.id > 0 && usedPersonIds.has(person.id)) continue;
    const mxid = personIdToMatrixUserId[person.id]?.trim().toLowerCase();
    if (mxid && usedMxids.has(mxid)) continue;
    if (isHyphaBot(personIdToMatrixUserId[person.id], personName(person, ''))) {
      continue;
    }
    const remembered = readRememberedPersonDirectRoom(person.id);
    const rememberedRoom = remembered
      ? rooms.find((room) => room.roomId === remembered)
      : undefined;
    const known = personIdToMatrixUserId[person.id]?.trim().toLowerCase();
    const rememberedPeer = rememberedRoom?.otherUserId?.trim().toLowerCase();
    const rememberedUsable =
      Boolean(rememberedRoom) &&
      !(known && rememberedPeer && known !== rememberedPeer);
    withoutRoom.push({
      person,
      name: personName(person, fallback),
      avatarUrl: person.avatarUrl || rememberedRoom?.avatarUrl || undefined,
      preview: rememberedRoom?.preview ?? '',
      mine: rememberedRoom?.mine ?? false,
      lastTs: rememberedRoom?.lastTs ?? null,
      unread: rememberedRoom?.unread ?? 0,
      roomId: rememberedUsable ? remembered : null,
    });
  }

  return [...fromRooms, ...withoutRoom].sort((left, right) => {
    const byTime = (right.lastTs ?? 0) - (left.lastTs ?? 0);
    if (byTime !== 0) return byTime;
    return left.name.localeCompare(right.name);
  });
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
    const name = face.userId
      ? visibleMatrixMemberName(face.userId, profile?.name, face.name)
      : profile?.name.trim() || face.name;
    return {
      ...face,
      name: name || face.name,
      avatarUrl: profile?.avatarUrl || face.avatarUrl,
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

function compactUsername(value: string) {
  return value.toLowerCase().replace(/[@._\s-]/g, '');
}

/** Name and username match, including `vladhram` vs `vlad-hramtsov`. */
export function textMatchesPeopleSearch(
  parts: readonly (string | null | undefined)[],
  needle: string,
) {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  const fields = parts.filter((part): part is string => Boolean(part?.trim()));
  if (fields.join(' ').toLowerCase().includes(query)) return true;
  const compact = compactUsername(query);
  if (!compact) return false;
  return fields.some((part) => compactUsername(part).includes(compact));
}

/** Directory people matching a Messages search by name or username. */
export function connectionMatchesPeopleSearch(
  person: {
    name?: string | null;
    surname?: string | null;
    nickname?: string | null;
    slug?: string | null;
  },
  needle: string,
) {
  return textMatchesPeopleSearch(
    [person.name, person.surname, person.nickname, person.slug],
    needle,
  );
}

/** Local connections plus search hits, so a query is not rooms-only. */
export function peopleMatchingSearch<
  T extends {
    id: number;
    name?: string | null;
    surname?: string | null;
    nickname?: string | null;
    slug?: string | null;
  },
>(
  connections: readonly T[],
  searchHits: readonly T[] | null | undefined,
  needle: string,
): T[] {
  const query = needle.trim().toLowerCase();
  if (!query) return [...connections];
  const byId = new Map<number, T>();
  for (const person of connections) {
    if (connectionMatchesPeopleSearch(person, query))
      byId.set(person.id, person);
  }
  for (const person of searchHits ?? []) {
    if (connectionMatchesPeopleSearch(person, query))
      byId.set(person.id, person);
  }
  return [...byId.values()];
}

/**
 * Add-people candidates: name/username search, excluding only people whose
 * Matrix id is already joined or invited. A missing mxid is not "already here".
 */
export function addablePeopleForGroup<
  T extends {
    id: number;
    name?: string | null;
    surname?: string | null;
    nickname?: string | null;
    slug?: string | null;
  },
>(
  connections: readonly T[],
  searchHits: readonly T[] | null | undefined,
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
  roomMemberIds: ReadonlySet<string>,
  needle: string,
): T[] {
  return peopleMatchingSearch(connections, searchHits, needle).filter(
    (person) => {
      const mxid = personIdToMatrixUserId[person.id]?.trim().toLowerCase();
      return !(mxid && roomMemberIds.has(mxid));
    },
  );
}

/** People Around search: title, profile fields, and group faces. */
export function conversationMatchesSearch(
  row: {
    name: string;
    person?: {
      name?: string | null;
      surname?: string | null;
      nickname?: string | null;
      slug?: string | null;
    };
    faces?: readonly { name?: string | null }[];
    searchMembers?: readonly {
      name?: string | null;
      nickname?: string | null;
      slug?: string | null;
      userId?: string | null;
    }[];
  },
  needle: string,
) {
  return textMatchesPeopleSearch(
    [
      row.name,
      row.person?.name,
      row.person?.surname,
      row.person?.nickname,
      row.person?.slug,
      ...(row.faces ?? []).map((face) => face.name),
      ...(row.searchMembers ?? []).flatMap((member) => [
        member.name,
        member.nickname,
        member.slug,
        member.userId?.replace(/^@/, '').split(':')[0],
      ]),
    ],
    needle,
  );
}

/** Keep the search filter when a selected chip is removed. */
export function conversationsMatchingSearch<
  T extends Parameters<typeof conversationMatchesSearch>[0],
>(rows: readonly T[], needle: string): T[] {
  const query = needle.trim();
  if (!query) return [...rows];
  return rows.filter((row) => conversationMatchesSearch(row, query));
}

export type ListedConversationOpen =
  | {
      kind: 'listed-room';
      roomId: string;
      title: string;
      peerSlug: string | null;
    }
  | { kind: 'ensure-person' };

export type ListedConversationLookup = {
  rooms?: readonly Pick<
    ConversationRow,
    | 'roomId'
    | 'otherUserId'
    | 'kind'
    | 'roomType'
    | 'preview'
    | 'lastTs'
    | 'name'
  >[];
  personIdToMatrixUserId?: Readonly<Record<number, string | undefined>>;
  peopleBySub?: ReadonlyMap<string, Pick<PeerProfileBySub, 'id'>>;
  rememberedRoomId?: string | null;
};

function listedRowShowsConversation(row: {
  preview?: string | null;
  lastTs?: number | null;
}) {
  return Boolean(row.preview?.trim() || row.lastTs != null);
}

/**
 * Room already on the row, or the typed DM that produced its preview.
 * Never invents a room — create/ensure stays a separate path.
 */
function listedRoomIdIsCurrentPeer(
  roomId: string,
  personId: number,
  lookup?: ListedConversationLookup,
): boolean {
  const rooms = lookup?.rooms;
  if (rooms && !rooms.some((room) => room.roomId.trim() === roomId)) {
    return false;
  }
  const mxid = lookup?.personIdToMatrixUserId?.[personId]?.trim().toLowerCase();
  if (!mxid) return true;
  const room = rooms?.find((candidate) => candidate.roomId.trim() === roomId);
  const other = room?.otherUserId?.trim().toLowerCase();
  if (!other) return true;
  return other === mxid;
}

function usableListedRoomId(
  roomId: string | null | undefined,
  personId: number,
  lookup?: ListedConversationLookup,
): string | null {
  const id = roomId?.trim();
  if (!id) return null;
  return listedRoomIdIsCurrentPeer(id, personId, lookup) ? id : null;
}

export function resolveListedConversationRoomId(
  row: {
    roomId: string | null | undefined;
    name: string;
    preview?: string | null;
    lastTs?: number | null;
    person: { id: number };
  },
  lookup?: ListedConversationLookup,
): string | null {
  const listed = usableListedRoomId(row.roomId, row.person.id, lookup);
  if (listed) return listed;
  const remembered = usableListedRoomId(
    lookup?.rememberedRoomId?.trim() ||
      readRememberedPersonDirectRoom(row.person.id),
    row.person.id,
    lookup,
  );
  if (remembered) return remembered;
  const rooms = lookup?.rooms;
  if (!rooms || row.person.id <= 0) return null;
  const mxid = lookup.personIdToMatrixUserId?.[row.person.id]
    ?.trim()
    .toLowerCase();
  const nameMatches: string[] = [];
  const needle = row.name.trim().toLowerCase();
  for (const room of rooms) {
    if (!isTypedDmConversation(room as ConversationRow)) continue;
    if (!listedRoomIdIsCurrentPeer(room.roomId, row.person.id, lookup)) {
      continue;
    }
    const other = room.otherUserId?.trim();
    const otherKey = other?.toLowerCase();
    if (mxid && otherKey === mxid) return room.roomId;
    if (other) {
      const sub = matrixUserIdToCanonicalPrivySub(other);
      const fetchedId = sub ? lookup.peopleBySub?.get(sub)?.id : undefined;
      if (fetchedId === row.person.id) return room.roomId;
    }
    if (
      needle &&
      room.name.trim().toLowerCase() === needle &&
      !looksLikeTechnicalMatrixDisplayName(
        room.name,
        room.otherUserId ?? room.roomId,
      )
    ) {
      nameMatches.push(room.roomId);
    }
  }
  return nameMatches.length === 1 ? nameMatches[0] ?? null : null;
}

/**
 * Tap a Messages row. Use the room already on the row (or the listed DM
 * that produced its preview). Only fall through to create/ensure when the
 * directory person has no conversation yet.
 */
export function listedConversationOpenTarget(
  row: {
    roomId: string | null | undefined;
    name: string;
    preview?: string | null;
    lastTs?: number | null;
    person: { id: number; slug?: string | null };
  },
  lookup?: ListedConversationLookup,
): ListedConversationOpen | null {
  const roomId = resolveListedConversationRoomId(row, lookup);
  if (roomId) {
    return {
      kind: 'listed-room',
      roomId,
      title: row.name,
      peerSlug: row.person.slug?.trim() || null,
    };
  }
  if (listedRowShowsConversation(row)) {
    return null;
  }
  if (row.person.id > 0) {
    return { kind: 'ensure-person' };
  }
  return null;
}

/**
 * Group-pick candidates. Synthetic DM rows (`person.id <= 0`) stay on
 * Messages but cannot be selected — they have no directory person id.
 */
export function membersForGroupPicker<T extends { person: { id: number } }>(
  rows: readonly T[],
  picking: boolean,
): T[] {
  if (!picking) return [...rows];
  return rows.filter((row) => row.person.id > 0);
}

/**
 * A private group chat, not a space channel.
 * Same gate as production: typed group, remembered Messages group, or a
 * comma-titled room with 3+ humans. Untyped space / proposal / signal rooms
 * have 3+ members too — they stay out because their titles have no comma
 * and they are not remembered as group chats.
 */
export function isPeopleListGroup(room: ConversationRow) {
  if (room.kind !== 'group' || room.signalThread) return false;
  if (
    !conversationRoomType(room) &&
    looksLikeTechnicalMatrixDisplayName(
      room.name,
      room.otherUserId ?? room.roomId,
    )
  ) {
    return false;
  }
  if (
    room.roomType &&
    room.roomType !== HYPHA_ROOM_TYPES.group &&
    room.roomType.startsWith('io.hypha.room.')
  ) {
    return false;
  }
  if (room.roomType === HYPHA_ROOM_TYPES.group) return true;
  if (room.groupChat || isRememberedGroupChatRoom(room.roomId)) return true;
  if (!room.name.includes(',')) return false;
  return (room.memberCount ?? 0) > 2 || countCommaSeparatedNames(room.name) > 2;
}

/**
 * Kind + People Around gate used by the rendered Messages list.
 * A joined untyped named room with 3+ summary members and 1 loaded member
 * still produces a row when the title names three people.
 */
export function peopleAroundGroupRows<T extends ConnectionListPerson>(
  rooms: readonly {
    roomId: string;
    name: string;
    roomType?: string | null;
    loadedHumanCount: number;
    summaryJoinedCount: number;
    hasRoomName?: boolean;
    titleMemberHint?: number;
    rememberedHumanCount?: number;
    createdAsGroup?: boolean;
    groupChat?: boolean;
    signalThread?: boolean;
    archived?: boolean;
  }[],
  fallback: string,
): MemberRow<T>[] {
  const rows: ConversationRow[] = [];
  for (const room of rooms) {
    const kind = peopleConversationKindForListing({
      roomType: room.roomType,
      loadedHumanCount: room.loadedHumanCount,
      summaryJoinedCount: room.summaryJoinedCount,
      createdAsGroup: room.createdAsGroup,
      hasRoomName: room.hasRoomName ?? Boolean(room.name.trim()),
      titleMemberHint:
        room.titleMemberHint ?? countCommaSeparatedNames(room.name),
      rememberedHumanCount: room.rememberedHumanCount,
      rememberedAsGroup: room.groupChat,
    });
    if (kind !== 'group') continue;
    const row: ConversationRow = {
      roomId: room.roomId,
      name: room.name,
      preview: '',
      mine: false,
      lastTs: null,
      unread: 0,
      memberCount: room.loadedHumanCount,
      otherUserId: null,
      roomType: room.roomType ?? null,
      groupChat: room.groupChat,
      kind,
      signalThread: room.signalThread,
      archived: room.archived,
    };
    if (!isPeopleListGroup(row)) continue;
    rows.push(row);
  }
  return groupRowsForConnections<T>(rows, fallback);
}

/** Group chats mixed into the people list. One row per room, with two faces. */
export function groupRowsForConnections<T extends ConnectionListPerson>(
  rooms: readonly ConversationRow[],
  fallback: string,
): MemberRow<T>[] {
  const hiddenPairs = new Set(hiddenLegacyPairRoomIds(rooms));
  return rooms
    .filter((room) => isPeopleListGroup(room) && !hiddenPairs.has(room.roomId))
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
        senderUserId: room.senderUserId,
        lastTs: room.lastTs,
        unread: room.unread,
        roomId: room.roomId,
        archived: room.archived,
        searchMembers: room.searchMembers,
      };
    });
}

export function enrichSearchMembers<T extends ConnectionListPerson>(
  members:
    | readonly {
        name: string;
        nickname?: string | null;
        slug?: string | null;
        userId?: string;
      }[]
    | undefined,
  profiles: ReadonlyMap<string, { name: string; avatarUrl?: string }>,
  connections: readonly MemberRow<T>[],
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
  peopleByMxid?: ReadonlyMap<
    string,
    {
      name?: string | null;
      nickname?: string | null;
      slug?: string | null;
    }
  >,
) {
  const personByMxid = new Map<string, T>();
  for (const row of connections) {
    const mxid = personIdToMatrixUserId[row.person.id]?.trim().toLowerCase();
    if (mxid) personByMxid.set(mxid, row.person);
  }
  return (members ?? []).map((member) => {
    const mxid = member.userId?.trim().toLowerCase();
    const profile = mxid ? profiles.get(mxid) : undefined;
    const person = mxid ? personByMxid.get(mxid) : undefined;
    const resolved = mxid ? peopleByMxid?.get(mxid) : undefined;
    return {
      name:
        (mxid
          ? visibleMatrixMemberName(
              mxid,
              resolved?.name,
              profile?.name,
              person ? personName(person, '') : '',
              member.name,
            )
          : resolved?.name || profile?.name || member.name) || member.name,
      nickname:
        resolved?.nickname ?? person?.nickname ?? member.nickname ?? null,
      slug: resolved?.slug ?? person?.slug ?? member.slug ?? null,
      userId: member.userId,
    };
  });
}

/**
 * Matrix ids for every selected directory person. `null` if any id is
 * still loading or missing — do not create the room until this returns.
 */
export function resolvedMatrixIdsForGroup(
  selected: readonly { person: { id: number } }[],
  personIdToMatrixUserId: Readonly<Record<number, string | undefined>>,
): string[] | null {
  const memberIds: string[] = [];
  for (const row of selected) {
    const mxid = personIdToMatrixUserId[row.person.id]?.trim();
    if (!mxid) return null;
    memberIds.push(mxid);
  }
  return memberIds;
}

/** Keep group-pick selections even when search hides those rows. */
export function nextSelectedMembers<T extends ConnectionListPerson>(
  current: ReadonlyMap<number, MemberRow<T>>,
  row: MemberRow<T>,
): Map<number, MemberRow<T>> {
  // Directory people only. Synthetic DM / group rows use negative ids
  // derived from the room, not a Hypha person, and cannot be invited.
  if (row.person.id <= 0) return new Map(current);
  const next = new Map(current);
  if (next.has(row.person.id)) next.delete(row.person.id);
  else next.set(row.person.id, row);
  return next;
}

/** Messages hides archived groups; Archived shows only those groups. */
export function conversationsVisibleInSection<T extends ConnectionListPerson>(
  rows: readonly MemberRow<T>[],
  section: 'messages' | 'archived',
) {
  return rows.filter((row) =>
    section === 'archived' ? Boolean(row.archived) : !row.archived,
  );
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
