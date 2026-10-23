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

/**
 * A Messages group stays a group even with two people or after a rename.
 * Typed DMs and other Hypha room kinds never qualify.
 */
export function isPeopleGroupRoomType(
  roomType: string | null | undefined,
  joinedMemberCount: number,
  flags: { hasCreator?: boolean; remembered?: boolean } = {},
): boolean {
  const type = roomType?.trim() || null;
  if (type === HYPHA_ROOM_TYPES.group) return true;
  if (type) return false;
  if (flags.hasCreator || flags.remembered) return true;
  return joinedMemberCount > 2;
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
