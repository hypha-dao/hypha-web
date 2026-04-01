import { db } from '@hypha-platform/storage-postgres';
import { MatrixUserLink } from '../../types';
import { findLinkByPrivyUserId } from '../queries';

interface GetLinkByPrivyUserIdInput {
  privyUserId: string;
  environment: string;
}

export async function getLinkByPrivyUserId({
  privyUserId,
  environment,
}: GetLinkByPrivyUserIdInput): Promise<MatrixUserLink | null> {
  try {
    const userLink = await findLinkByPrivyUserId(
      {
        privyUserId,
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
    throw new Error('Failed to get Privy user ID from Matrix user link', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
