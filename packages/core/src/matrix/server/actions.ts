'use server';

import { getLinkByMatrixUserId } from './web3/get-link-by-matrix-user-id';
import { Environment } from '../../coherence/types';

export async function getLinkByMatrixUserIdAction({
  matrixUserId,
  environment,
}: {
  matrixUserId: string;
  environment: Environment;
}) {
  return getLinkByMatrixUserId({ matrixUserId, environment });
}
