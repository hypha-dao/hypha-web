import {
  countCommaSeparatedNames,
  isGroupCreateContent,
  peopleConversationKindForListing,
  readCreateContent,
  readGroupRoomCreatorUserId,
  readRoomNameState,
} from '../../../../core/src/matrix/group-room';

import {
  isHyphaBot,
  isRememberedGroupChatRoom,
  rememberedGroupChatMemberIds,
} from '../../people/components/member-connections';

type RoomMemberLike = {
  userId?: string;
  membership?: string;
  name?: string;
  rawDisplayName?: string;
};

function joinedRoomMembers(room: {
  getJoinedMembers?: () => RoomMemberLike[];
  getMembers?: () => RoomMemberLike[];
}): RoomMemberLike[] {
  try {
    const joined = room.getJoinedMembers?.();
    if (joined && joined.length > 0) return joined;
  } catch {
    // Fall through to getMembers().
  }
  try {
    return (room.getMembers?.() ?? []).filter(
      (member) => member.membership === 'join',
    );
  } catch {
    return [];
  }
}

function humanMemberCounts(room: {
  getJoinedMemberCount?: () => number;
  getJoinedMembers?: () => RoomMemberLike[];
  getMembers?: () => RoomMemberLike[];
}) {
  const rawSummary = room.getJoinedMemberCount?.() ?? 0;
  const joined = joinedRoomMembers(room);
  if (joined.length === 0) {
    return { loaded: rawSummary, summary: rawSummary };
  }
  const humans = joined.filter((member) => {
    if (!member.userId) return false;
    return !isHyphaBot(member.userId, member.name || member.rawDisplayName);
  });
  const loaded = humans.length;
  const botsSeen = joined.length - loaded;
  // Bots inflate getJoinedMemberCount(). When the member list is complete,
  // do not let that leftover trip the incomplete-summary group keep rule.
  const summary =
    joined.length >= rawSummary
      ? loaded
      : Math.max(loaded, rawSummary - botsSeen);
  return { loaded, summary };
}

export function isPeopleGroupChatRoom(
  room:
    | (Parameters<typeof readGroupRoomCreatorUserId>[0] & {
        roomId?: string;
        name?: string;
        getType?: () => string | null | undefined;
        getJoinedMemberCount?: () => number;
        getJoinedMembers?: () => RoomMemberLike[];
        getMembers?: () => RoomMemberLike[];
      })
    | null,
) {
  if (!room) return false;
  const { loaded, summary } = humanMemberCounts(room);
  const nameState = readRoomNameState(room);
  const titleMemberHint = countCommaSeparatedNames(nameState || room.name);
  const remembered = room.roomId
    ? rememberedGroupChatMemberIds(room.roomId).length + 1
    : 0;
  return (
    peopleConversationKindForListing({
      roomType: room.getType?.(),
      loadedHumanCount: loaded,
      summaryJoinedCount: summary,
      createdAsGroup: isGroupCreateContent(readCreateContent(room)),
      hasRoomName: Boolean(nameState) || titleMemberHint > 2,
      titleMemberHint,
      rememberedHumanCount: remembered,
      rememberedAsGroup: Boolean(
        room.roomId && isRememberedGroupChatRoom(room.roomId),
      ),
    }) === 'group'
  );
}

export function canArchivePeopleGroupRoom(
  room: Parameters<typeof readGroupRoomCreatorUserId>[0] & {
    roomId?: string;
    getMember?: (userId: string) => { powerLevel?: number } | null;
  },
  selfId: string | null | undefined,
  isLocalCreator?: (roomId: string) => boolean,
) {
  const userId = selfId?.trim();
  if (!userId) return false;
  const creator = readGroupRoomCreatorUserId(room);
  if (creator === userId) return true;
  if ((room.getMember?.(userId)?.powerLevel ?? 0) >= 100) return true;
  if (creator) return false;
  if (room.roomId && isLocalCreator?.(room.roomId)) return true;
  // Legacy groups have no stored human creator (the bot created the room).
  return true;
}
