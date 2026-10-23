import { HYPHA_ROOM_TYPES } from './room-types';

/** Custom room state: who started this Messages group (bot is the Matrix creator). */
export const GROUP_ROOM_CREATOR_STATE = 'io.hypha.room.group_creator';
/** Custom room state: hide this group from everyone's Messages list. */
export const GROUP_ROOM_ARCHIVED_STATE = 'io.hypha.room.archived';

export const GROUP_ROOM_NAME_MAX = 120;

export function normalizeGroupRoomName(name: string): string {
  return Array.from(name.replace(/\s+/g, ' ').trim())
    .slice(0, GROUP_ROOM_NAME_MAX)
    .join('');
}

export function isGroupRoomArchivedContent(
  content: Record<string, unknown> | null | undefined,
): boolean {
  return content?.archived === true;
}

type StateEventLike = {
  getContent?: () => Record<string, unknown>;
} | null;

type StateEventReader = {
  currentState?: {
    getStateEvents?: (
      type: string,
      key?: string,
    ) => StateEventLike | StateEventLike[];
  };
};

function nameFromStateEvent(event: StateEventLike): string | null {
  const name = event?.getContent?.()?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function readStateEvent(
  room: StateEventReader | null | undefined,
  type: string,
): StateEventLike {
  const event = room?.currentState?.getStateEvents?.(type, '');
  if (Array.isArray(event)) return event[0] ?? null;
  return event ?? null;
}

export function isArchivedGroupRoom(room: StateEventReader | null | undefined) {
  return isGroupRoomArchivedContent(
    readStateEvent(room, GROUP_ROOM_ARCHIVED_STATE)?.getContent?.(),
  );
}

export function readGroupRoomCreatorUserId(
  room: StateEventReader | null | undefined,
) {
  return groupRoomCreatorUserId(
    readStateEvent(room, GROUP_ROOM_CREATOR_STATE)?.getContent?.(),
  );
}

export function groupRoomCreatorUserId(
  content: Record<string, unknown> | null | undefined,
): string | null {
  const userId =
    typeof content?.userId === 'string' ? content.userId.trim() : '';
  return userId || null;
}

export function readRoomNameState(
  room: StateEventReader | null | undefined,
): string | null {
  const get = room?.currentState?.getStateEvents;
  if (!get) return null;
  const keyed = get.call(room.currentState, 'm.room.name', '');
  if (!Array.isArray(keyed)) {
    const named = nameFromStateEvent(keyed);
    if (named) return named;
  }
  const all = Array.isArray(keyed)
    ? keyed
    : get.call(room.currentState, 'm.room.name');
  if (Array.isArray(all)) {
    for (const event of all) {
      const named = nameFromStateEvent(event);
      if (named) return named;
    }
  }
  return null;
}

export function readCreateContent(
  room: StateEventReader | null | undefined,
): Record<string, unknown> | undefined {
  return readStateEvent(room, 'm.room.create')?.getContent?.();
}

export function isGroupCreateContent(
  content: Record<string, unknown> | null | undefined,
): boolean {
  const type = typeof content?.type === 'string' ? content.type.trim() : '';
  return type === HYPHA_ROOM_TYPES.group;
}

export function isRoomInDirectAccountData(
  direct: Record<string, unknown> | null | undefined,
  roomId: string,
): boolean {
  const id = roomId.trim();
  if (!id || !direct) return false;
  for (const value of Object.values(direct)) {
    if (!Array.isArray(value)) continue;
    if (
      value.some((entry) => typeof entry === 'string' && entry.trim() === id)
    ) {
      return true;
    }
  }
  return false;
}

export type PeopleGroupRoomFlags = {
  /** `m.room.create` type is a Messages group when `getType()` is empty. */
  createdAsGroup?: boolean;
};

/** Extra listing hints so a rename cannot hide a group while members are lazy. */
export type PeopleConversationListingInput = {
  roomType: string | null | undefined;
  /** Humans already in `getMembers()` after bot filtering. */
  loadedHumanCount: number;
  /** Room summary `joined_member_count` (includes bots). */
  summaryJoinedCount: number;
  createdAsGroup?: boolean;
  /** Explicit `m.room.name` — set by rename and some creations. */
  hasRoomName?: boolean;
  /** Comma-separated title parts (`A, B, C (test)` → 3). */
  titleMemberHint?: number;
  /** People remembered for this group, plus a guess for self. */
  rememberedHumanCount?: number;
};

/** `"Gerardo Roza, Xerxes Potel, Vlad Hramtsov (test)"` → 3. */
export function countCommaSeparatedNames(
  name: string | null | undefined,
): number {
  if (!name?.trim()) return 0;
  return name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean).length;
}

/**
 * Messages groups are `io.hypha.room.group` (or the same type on create).
 * Typed DMs stay 1:1. Untyped rooms are groups only with 3+ joined humans —
 * two-person untyped rooms are never DMs and never groups.
 */
export function isPeopleGroupRoomType(
  roomType: string | null | undefined,
  joinedMemberCount: number,
  flags: PeopleGroupRoomFlags = {},
): boolean {
  const type = roomType?.trim() || null;
  if (type === HYPHA_ROOM_TYPES.group || flags.createdAsGroup) return true;
  if (type === HYPHA_ROOM_TYPES.dm) return false;
  if (type) return false;
  return joinedMemberCount > 2;
}

/**
 * What the People Around list does with a joined room after archive/bot/signal
 * filters: a group row, a typed DM, or drop (untyped 1:1s are hidden).
 */
export function peopleConversationKind(
  roomType: string | null | undefined,
  joinedMemberCount: number,
  flags: PeopleGroupRoomFlags = {},
): 'group' | 'person' | null {
  if (isPeopleGroupRoomType(roomType, joinedMemberCount, flags)) return 'group';
  if ((roomType?.trim() || null) === HYPHA_ROOM_TYPES.dm) return 'person';
  return null;
}

/**
 * List classification that keeps an untyped 3-person group visible after a
 * rename/reload while Matrix has only lazy-loaded the current member.
 * Rename writes `m.room.name` only — it does not change room type.
 */
export function peopleConversationKindForListing(
  input: PeopleConversationListingInput,
): 'group' | 'person' | null {
  const flags = { createdAsGroup: input.createdAsGroup };
  const loaded = peopleConversationKind(
    input.roomType,
    input.loadedHumanCount,
    flags,
  );
  if (loaded) return loaded;
  const type = input.roomType?.trim() || null;
  if (type === HYPHA_ROOM_TYPES.dm) return 'person';
  if (type) return null;
  const titleHint = input.titleMemberHint ?? 0;
  const remembered = input.rememberedHumanCount ?? 0;
  // Untyped + named + 3 joined humans (title, memory, or loaded) must stay.
  // A stale 2/2 summary is not enough to hide that shape. m.direct is ignored.
  if (
    input.hasRoomName &&
    (input.loadedHumanCount > 2 || titleHint > 2 || remembered > 2)
  ) {
    return 'group';
  }
  const membersIncomplete = input.loadedHumanCount < input.summaryJoinedCount;
  if (membersIncomplete && input.summaryJoinedCount > 2) return 'group';
  // Named untyped rooms stay listed until the full member list arrives.
  // A completed 2-human list still drops (typed-room rule).
  if (membersIncomplete && input.hasRoomName) return 'group';
  if (input.loadedHumanCount <= 1 && input.hasRoomName) return 'group';
  return null;
}

/**
 * Newest last-message first. Equal times stay stable by name, then room id.
 * Unread and presence must not move a recent chat below the fold.
 */
export function sortConversationsByLastMessage<
  T extends {
    lastTs: number | null | undefined;
    name: string;
    roomId?: string | null;
  },
>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const byTime = (right.lastTs ?? 0) - (left.lastTs ?? 0);
    if (byTime !== 0) return byTime;
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return (left.roomId ?? '').localeCompare(right.roomId ?? '');
  });
}

/** Last human message only. Name changes and other room events do not count. */
export function conversationActivityTs(
  lastMessageTs: number | null | undefined,
  _roomActiveTs?: number | null,
): number | null {
  return typeof lastMessageTs === 'number' && lastMessageTs > 0
    ? lastMessageTs
    : null;
}

/**
 * A group chat is its own invite-only room. People only see it once they are
 * joined. An invite left sitting in Matrix never shows up in the people list.
 */
export function isAutoJoinGroupInvite({
  membership,
  canonicalAlias,
  roomName,
  creatorUserId,
  botUserId,
}: {
  membership: string | null | undefined;
  canonicalAlias: string | null | undefined;
  roomName: string | null | undefined;
  creatorUserId: string | null | undefined;
  botUserId: string | null | undefined;
}): boolean {
  if (membership !== 'invite') return false;
  if (canonicalAlias?.trim()) return false;
  const name = roomName?.trim() ?? '';
  if (!name.includes(',')) return false;
  const bot = botUserId?.trim();
  const creator = creatorUserId?.trim();
  if (!bot || !creator) return false;
  return creator === bot;
}
