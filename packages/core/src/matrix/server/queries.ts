import { MatrixUserLink } from '@hypha-platform/storage-postgres';
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
