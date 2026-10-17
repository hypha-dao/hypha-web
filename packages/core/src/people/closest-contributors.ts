/** How many closest people the home shows as direct-access icons. */
export const CLOSEST_CONTRIBUTOR_LIMIT = 8;

export type ClosestBasis = 'messages' | 'sharedSpaces';

export type ConversationSnapshot = {
  joinedUserIds: readonly string[];
  /**
   * Senders of real messages already loaded for this room.
   * Includes the caller. Edits, redactions, and non-messages stay out.
   */
  messageSenderIds: readonly string[];
};

export type NamedRoomSnapshot = {
  roomId: string;
  name: string;
  joinedUserIds: readonly string[];
  /** Latest activity, so several chats with the same person reopen the used one. */
  lastActiveTs?: number;
  /** Loaded messages. An empty room created by mistake loses to the real chat. */
  messageCount?: number;
};

/**
 * Counts loaded conversation volume per Matrix user.
 * A room with one other member counts every loaded message toward them.
 * A larger room counts only messages that other member sent.
 * Rooms with no loaded messages add nothing.
 */
export function messageCountsByMatrixUser(
  rooms: readonly ConversationSnapshot[],
  selfUserId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  const self = selfUserId.trim();
  if (!self) return counts;

  const add = (userId: string, amount: number) => {
    if (!userId || userId === self || amount <= 0) return;
    counts.set(userId, (counts.get(userId) ?? 0) + amount);
  };

  for (const room of rooms) {
    const others = [
      ...new Set(room.joinedUserIds.filter((id) => id && id !== self)),
    ];
    if (others.length === 0 || room.messageSenderIds.length === 0) continue;
    if (others.length === 1) {
      const other = others[0];
      if (other) add(other, room.messageSenderIds.length);
      continue;
    }
    for (const sender of room.messageSenderIds) add(sender, 1);
  }

  return counts;
}

/** Maps Matrix user ids back onto Hypha people. Unknown users are left out. */
export function messageCountsByPersonId(
  countsByMatrixUser: ReadonlyMap<string, number>,
  personIdToMatrixUserId: Readonly<Record<number, string>>,
): Map<number, number> {
  const personByMatrixUser = new Map<string, number>();
  for (const [personId, matrixUserId] of Object.entries(
    personIdToMatrixUserId,
  )) {
    if (!matrixUserId) continue;
    const id = Number(personId);
    if (!Number.isInteger(id)) continue;
    personByMatrixUser.set(matrixUserId, id);
  }

  const counts = new Map<number, number>();
  for (const [matrixUserId, count] of countsByMatrixUser) {
    const personId = personByMatrixUser.get(matrixUserId);
    if (personId == null || count <= 0) continue;
    counts.set(personId, count);
  }
  return counts;
}

/**
 * People with loaded messages come first, by how many.
 * With no per-person messages, the order is shared spaces.
 */
export function rankClosestContributors<
  T extends { id: number; sharedSpaceCount: number },
>(
  people: readonly T[],
  messageCounts: ReadonlyMap<number, number>,
  limit = CLOSEST_CONTRIBUTOR_LIMIT,
): { people: T[]; basis: ClosestBasis } {
  const cap = Math.max(limit, 0);
  const byShared = (left: T, right: T) =>
    right.sharedSpaceCount - left.sharedSpaceCount || left.id - right.id;
  const talked = people.filter(
    (person) => (messageCounts.get(person.id) ?? 0) > 0,
  );

  if (talked.length > 0) {
    return {
      basis: 'messages',
      people: [...talked]
        .sort((left, right) => {
          const byMessages =
            (messageCounts.get(right.id) ?? 0) -
            (messageCounts.get(left.id) ?? 0);
          if (byMessages !== 0) return byMessages;
          return byShared(left, right);
        })
        .slice(0, cap),
    };
  }

  return {
    basis: 'sharedSpaces',
    people: [...people].sort(byShared).slice(0, cap),
  };
}

/**
 * The direct room with this person. The title is a hint when several exist.
 * A room is still theirs when Matrix named it differently. Larger rooms stay out.
 */
export function findNamedDirectRoomId(
  rooms: readonly NamedRoomSnapshot[],
  selfUserId: string,
  otherUserId: string,
  roomName: string,
): string | null {
  const self = selfUserId.trim();
  const other = otherUserId.trim();
  const expected = roomName.trim().toLowerCase();
  if (!self || !other) return null;

  const direct = rooms.filter((room) => {
    const others = [
      ...new Set(room.joinedUserIds.filter((id) => id && id !== self)),
    ];
    return others.length === 1 && others[0] === other;
  });
  if (direct.length === 0) return null;
  const named = expected
    ? direct.find((room) => room.name.trim().toLowerCase() === expected)
    : undefined;
  const withHistory = direct.filter((room) => (room.messageCount ?? 0) > 0);
  const pool = named ? [named] : withHistory.length > 0 ? withHistory : direct;
  const [latest] = [...pool].sort(
    (left, right) =>
      (right.messageCount ?? 0) - (left.messageCount ?? 0) ||
      (right.lastActiveTs ?? 0) - (left.lastActiveTs ?? 0),
  );
  return latest?.roomId ?? null;
}
