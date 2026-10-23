import {
  isGroupCreateContent,
  peopleConversationKindForListing,
  readCreateContent,
  readGroupRoomCreatorUserId,
  readRoomNameState,
} from '../../../../core/src/matrix/group-room';

export function isPeopleGroupChatRoom(
  room:
    | (Parameters<typeof readGroupRoomCreatorUserId>[0] & {
        roomId?: string;
        getType?: () => string | null | undefined;
        getJoinedMemberCount?: () => number;
      })
    | null,
) {
  if (!room) return false;
  const summary = room.getJoinedMemberCount?.() ?? 0;
  return (
    peopleConversationKindForListing({
      roomType: room.getType?.(),
      loadedHumanCount: summary,
      summaryJoinedCount: summary,
      createdAsGroup: isGroupCreateContent(readCreateContent(room)),
      hasRoomName: Boolean(readRoomNameState(room)),
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
