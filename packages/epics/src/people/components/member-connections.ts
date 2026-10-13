export type ConnectionListPerson = {
  id: number;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl?: string | null;
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

function personName(person: ConnectionListPerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

function directRoomByMatrixId(rows: readonly ConversationRow[]) {
  const rooms = new Map<string, ConversationRow>();
  for (const row of rows) {
    if (row.kind !== 'person' || !row.otherUserId) continue;
    const current = rooms.get(row.otherUserId);
    if (!current || (row.lastTs ?? 0) >= (current.lastTs ?? 0)) {
      rooms.set(row.otherUserId, row);
    }
  }
  return rooms;
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
      const room = mxid ? direct.get(mxid) : undefined;
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
