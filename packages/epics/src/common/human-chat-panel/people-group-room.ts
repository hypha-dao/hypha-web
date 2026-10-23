import { readGroupRoomCreatorUserId } from '../../../../core/src/matrix/group-room';
import { HYPHA_ROOM_TYPES } from '../../../../core/src/matrix/room-types';

export function isPeopleGroupChatRoom(
  room: {
    getType?: () => string | null | undefined;
    getJoinedMemberCount?: () => number;
  } | null,
) {
  if (!room) return false;
  if (room.getType?.() === HYPHA_ROOM_TYPES.group) return true;
  return (room.getJoinedMemberCount?.() ?? 0) > 2;
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
  if (creator) return creator === userId;
  if ((room.getMember?.(userId)?.powerLevel ?? 0) >= 100) return true;
  if (room.roomId && isLocalCreator?.(room.roomId)) return true;
  // Legacy groups have no stored human creator (the bot created the room).
  return true;
}
