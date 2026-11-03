import { HYPHA_ROOM_TYPES } from './room-types';

export type DirectRoomCandidate = {
  roomId: string;
  membership?: string;
  type?: string | null;
  otherUserIds: readonly string[];
};

/** The joined typed DM for this person, if the client already has it. */
export function findJoinedDirectRoomId(
  rooms: readonly DirectRoomCandidate[],
  otherUserId: string,
): string | null {
  const other = otherUserId.trim().toLowerCase();
  if (!other) return null;
  for (const room of rooms) {
    if (room.membership && room.membership !== 'join') continue;
    if (room.type !== HYPHA_ROOM_TYPES.dm) continue;
    if (room.otherUserIds.some((id) => id.trim().toLowerCase() === other)) {
      return room.roomId;
    }
  }
  return null;
}

export type OpenDirectRoomFailure =
  | 'not-connected'
  | 'no-matrix-id'
  | 'open-failed';

export async function waitUntil(
  isReady: () => boolean,
  attempts: number,
  delayMs: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (isReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return isReady();
}
