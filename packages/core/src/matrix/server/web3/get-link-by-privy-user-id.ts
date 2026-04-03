import 'server-only';

import { db } from '@hypha-platform/storage-postgres';
import { MatrixUserLink } from '../../types';
import { findLinkByPrivyUserId } from '../queries';

import { Environment } from '../../../coherence/types';

interface GetLinkByPrivyUserIdInput {
  privyUserId: string;
  environment: Environment;
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

    return {
      ...userLink,
      environment: userLink.environment as Environment,
    };
  } catch (error) {
    throw new Error('Failed to get Privy user ID from Matrix user link', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
