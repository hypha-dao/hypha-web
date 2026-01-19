import { MatrixUserLink } from '@hypha-platform/storage-postgres';
import { DbConfig } from '../../server';

export const findLinkByPrivyUserId = async (
  { privyUserId }: { privyUserId: string },
  { db }: DbConfig,
): Promise<MatrixUserLink | null> => {
  const response = await db.query.matrixUserLinks.findFirst({
    where: (matrixUserLinks, { eq }) =>
      eq(matrixUserLinks.privyUserId, privyUserId),
  });

  if (!response) {
    return null;
  }

  return {
    ...response,
  };
};

export const findLinkByMatrixUserId = async (
  { matrixUserId }: { matrixUserId: string },
  { db }: DbConfig,
): Promise<MatrixUserLink | null> => {
  const response = await db.query.matrixUserLinks.findFirst({
    where: (matrixUserLinks, { eq }) =>
      eq(matrixUserLinks.matrixUserId, matrixUserId),
  });

  if (!response) {
    return null;
  }

  return {
    ...response,
  };
};
