'use server';

import { db } from '@hypha-platform/storage-postgres';
import { MatrixUserLink } from '../../types';
import { findLinkByMatrixUserId } from '../queries';

interface GetLinkByMatrixUserIdInput {
  matrixUserId: string;
  environment: string;
}

export async function getLinkByMatrixUserId({
  matrixUserId,
  environment,
}: GetLinkByMatrixUserIdInput): Promise<MatrixUserLink | null> {
  try {
    const userLink = await findLinkByMatrixUserId(
      {
        matrixUserId,
        environment,
      },
      { db },
    );

    if (!userLink) {
      return null;
    }

    const { deviceId, refreshToken, tokenExpiresAt, ...rest } = userLink;

    return {
      deviceId: deviceId ?? undefined,
      refreshToken: refreshToken ?? undefined,
      tokenExpiresAt: tokenExpiresAt ?? undefined,
      ...rest,
    };
  } catch (error) {
    throw new Error('Failed to get Matrix user ID from Matrix user link', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
