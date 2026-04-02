import { MatrixUserLink } from '@hypha-platform/storage-postgres';
import { DbConfig } from '../../server';

function escapeLikePattern(value: string): string {
  return value.replace(/%/g, '\%').replace(/_/g, '\_');
}

export const findLinkByPrivyUserId = async (
  { privyUserId, environment }: { privyUserId: string; environment: string },
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
  { matrixUserId, environment }: { matrixUserId: string; environment: string },
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
  { baseName, environment }: { baseName: string; environment: string },
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
