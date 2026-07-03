import {
  matrixUserLinks,
  people,
  type MatrixUserLink,
} from '@hypha-platform/storage-postgres';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

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
