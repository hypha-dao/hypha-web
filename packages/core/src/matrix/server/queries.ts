import {
  coherences,
  matrixUserLinks,
  people,
  spaces,
  type MatrixUserLink,
} from '@hypha-platform/storage-postgres';
import { and, eq, inArray, isNotNull, like } from 'drizzle-orm';

import { Environment } from '../../coherence/types';
import { DbConfig } from '../../server';

function escapeLikePattern(value: string): string {
  // Escape backslash first, then LIKE metacharacters
  // Each replacement produces a literal backslash prefix for the SQL LIKE pattern
  let result = '';
  for (const char of value) {
    if (char === '\\' || char === '%' || char === '_') {
      result += '\\' + char;
    } else {
      result += char;
    }
  }
  return result;
}

export const findLinkByPrivyUserId = async (
  {
    privyUserId,
    environment,
  }: { privyUserId: string; environment: Environment },
  { db }: DbConfig,
): Promise<MatrixUserLink | null> => {
  const response = await db.query.matrixUserLinks.findFirst({
    where: (matrixUserLinks, { eq, and }) =>
      and(
        eq(matrixUserLinks.privyUserId, privyUserId),
        eq(matrixUserLinks.environment, environment),
      ),
  });

  if (!response) {
    return null;
  }

  return response;
};

export const findLinkByMatrixUserId = async (
  {
    matrixUserId,
    environment,
  }: { matrixUserId: string; environment: Environment },
  { db }: DbConfig,
): Promise<MatrixUserLink | null> => {
  const response = await db.query.matrixUserLinks.findFirst({
    where: (matrixUserLinks, { eq, and }) =>
      and(
        eq(matrixUserLinks.matrixUserId, matrixUserId),
        eq(matrixUserLinks.environment, environment),
      ),
  });

  if (!response) {
    return null;
  }

  return response;
};

/** Batch lookup for mention picker: Hypha roster `person.sub` → Matrix MXID (same env). */
export const findMatrixUserIdsByPrivyUserIds = async (
  {
    privyUserIds,
    environment,
  }: { privyUserIds: string[]; environment: Environment },
  { db }: DbConfig,
): Promise<Array<{ privyUserId: string; matrixUserId: string }>> => {
  const ids = [...new Set(privyUserIds.map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      privyUserId: matrixUserLinks.privyUserId,
      matrixUserId: matrixUserLinks.matrixUserId,
    })
    .from(matrixUserLinks)
    .where(
      and(
        eq(matrixUserLinks.environment, environment),
        inArray(matrixUserLinks.privyUserId, ids),
      ),
    );

  return rows;
};

/** Batch lookup for mention picker: Hypha roster `person.id` → Matrix MXID (same env). */
export const findMatrixUserIdsByPersonIds = async (
  { personIds, environment }: { personIds: number[]; environment: Environment },
  { db }: DbConfig,
): Promise<Array<{ personId: number; matrixUserId: string }>> => {
  const ids = [
    ...new Set(personIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      personId: people.id,
      matrixUserId: matrixUserLinks.matrixUserId,
    })
    .from(people)
    .innerJoin(
      matrixUserLinks,
      and(
        eq(matrixUserLinks.privyUserId, people.sub),
        eq(matrixUserLinks.environment, environment),
      ),
    )
    .where(and(inArray(people.id, ids), isNotNull(people.sub)));

  return rows;
};

export const findAdminUserName = async (
  { baseName, environment }: { baseName: string; environment: Environment },
  { db }: DbConfig,
): Promise<string | null> => {
  const response = await db.query.matrixUserLinks.findFirst({
    where: (matrixUserLinks, { eq, and, like }) =>
      and(
        eq(matrixUserLinks.environment, environment),
        like(matrixUserLinks.privyUserId, `%${escapeLikePattern(baseName)}%`),
      ),
  });

  if (!response) {
    return null;
  }

  return response.privyUserId;
};

/** Space member rooms and signal threads must not be treated as Messages groups. */
export async function isRoomBoundToSpaceOrSignal(
  { roomId }: { roomId: string },
  { db }: DbConfig,
): Promise<boolean> {
  const trimmed = roomId.trim();
  if (!trimmed) return false;
  try {
    const [space] = await db
      .select({ id: spaces.id })
      .from(spaces)
      .where(eq(spaces.chatRoomId, trimmed))
      .limit(1);
    if (space) return true;
    const [signal] = await db
      .select({ id: coherences.id })
      .from(coherences)
      .where(eq(coherences.roomId, trimmed))
      .limit(1);
    return Boolean(signal);
  } catch (error) {
    console.warn(
      '[MatrixBot] Failed to check space/signal room binding:',
      trimmed,
      error instanceof Error ? error.message : error,
    );
    // Fail closed: a lookup error must not authorize rename/archive.
    return true;
  }
}

/** Room ids already used as a space chat or a signal thread (including archived). */
export async function findBoundChatRoomIdsAmong(
  { roomIds }: { roomIds: readonly string[] },
  { db }: DbConfig,
): Promise<string[]> {
  const ids = [
    ...new Set(roomIds.map((roomId) => roomId.trim()).filter(Boolean)),
  ];
  if (ids.length === 0) return [];
  try {
    const spaceRows = await db
      .select({ roomId: spaces.chatRoomId })
      .from(spaces)
      .where(inArray(spaces.chatRoomId, ids));
    const signalRows = await db
      .select({ roomId: coherences.roomId })
      .from(coherences)
      .where(inArray(coherences.roomId, ids));
    const bound = new Set<string>();
    for (const row of [...spaceRows, ...signalRows]) {
      const roomId = row.roomId?.trim();
      if (roomId) bound.add(roomId);
    }
    return [...bound];
  } catch (error) {
    console.warn(
      '[MatrixBot] Failed to list space/signal room bindings:',
      error instanceof Error ? error.message : error,
    );
    // Do not report unknown rooms as bound. The client persists this result.
    throw error;
  }
}
