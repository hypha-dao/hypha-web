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

type StateEventReader = {
  currentState?: {
    getStateEvents?: (
      type: string,
      key: string,
    ) => { getContent?: () => Record<string, unknown> } | null;
  };
};

export function isArchivedGroupRoom(room: StateEventReader | null | undefined) {
  const event = room?.currentState?.getStateEvents?.(
    GROUP_ROOM_ARCHIVED_STATE,
    '',
  );
  return isGroupRoomArchivedContent(event?.getContent?.());
}

export function readGroupRoomCreatorUserId(
  room: StateEventReader | null | undefined,
) {
  const event = room?.currentState?.getStateEvents?.(
    GROUP_ROOM_CREATOR_STATE,
    '',
  );
  return groupRoomCreatorUserId(event?.getContent?.());
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
  const event = room?.currentState?.getStateEvents?.('m.room.name', '');
  const name = event?.getContent?.()?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
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
  hasCreator?: boolean;
  remembered?: boolean;
  /** Explicit `m.room.name`, not a Matrix-synthesized member list. */
  hasRoomName?: boolean;
  /** Room id appears in the user's `m.direct` account data. */
  inDirect?: boolean;
  /** `m.room.create` type is a Messages group, even if `getType()` is empty. */
  createdAsGroup?: boolean;
};

/**
 * A Messages group stays a group even with two people or after a rename.
 * Typed DMs stay 1:1 chats. A named group-flow room stays a group even when
 * Matrix also filed it under `m.direct`.
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
  if (flags.hasCreator || flags.remembered) return true;
  if (flags.hasRoomName && joinedMemberCount >= 2) return true;
  if (flags.inDirect) return false;
  return joinedMemberCount > 2;
}

/**
 * What the People Around list does with a joined room after archive/bot/signal
 * filters: a group row, a typed DM, or drop (untyped person chats are hidden).
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
