import 'server-only';

import { db } from '@hypha-platform/storage-postgres';
import { MatrixUserLink } from '../../types';
import { findLinkByMatrixUserId } from '../queries';

import { Environment } from '../../../coherence/types';

interface GetLinkByMatrixUserIdInput {
  matrixUserId: string;
  environment: Environment;
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

    return {
      ...userLink,
      environment: userLink.environment as Environment,
    };
  } catch (error) {
    throw new Error('Failed to get Matrix user ID from Matrix user link', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
