import { MatrixUserLink } from '@hypha-platform/storage-postgres';
import { DbConfig } from '../../server';

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

  return {
    ...response,
  };
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

  return {
    ...response,
  };
};
