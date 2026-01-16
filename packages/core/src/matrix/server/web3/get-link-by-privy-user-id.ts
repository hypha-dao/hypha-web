import { db } from '@hypha-platform/storage-postgres';
import { MatrixUserLink } from '../../types';
import { findLinkByPrivyUserId } from '../queries';

interface GetLinkByPrivyUserIdInput {
  privyUserId: string;
}

export async function getLinkByPrivyUserId({
  privyUserId,
}: GetLinkByPrivyUserIdInput): Promise<MatrixUserLink | null> {
  try {
    const userLink = await findLinkByPrivyUserId(
      {
        privyUserId,
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
    throw new Error('Failed to get Privy user ID from Matrix user link', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
