'use server';

/**
 * Server actions for Matrix user link management.
 * These actions must only be called from pre-authenticated API routes
 * that have already verified the auth token (e.g., via PrivyClient).
 * The authToken parameter serves as a guard to ensure callers are
 * authentication-aware, not as a verification mechanism.
 */

import { db } from '@hypha-platform/storage-postgres';
import {
  CreateMatrixUserLinkInput,
  GetAdminUserNameActionInput,
  GetMatrixUserLinkActionInput,
  UpdateEncryptedAccessTokenInput,
} from '../types';
import { createMatrixUserLink, updateMatrixUserLink } from './mutations';
import {
  findAdminUserName,
  findLinkByPrivyUserId,
  findMatrixUserIdsByPersonIds,
  findMatrixUserIdsByPrivyUserIds,
} from './queries';
import { getLinkByMatrixUserId } from './web3/get-link-by-matrix-user-id';
import { Environment } from '../../coherence/types';

export async function createMatrixUserLinkAction(
  data: CreateMatrixUserLinkInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to create Matrix user link');
  }
  return await createMatrixUserLink({ ...data }, { db });
}

export async function updateEncryptedAccessTokenAction(
  data: UpdateEncryptedAccessTokenInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error(
      'authToken is required to update Matrix user link encrypted access token',
    );
  }
  return await updateMatrixUserLink(data, { db });
}

export async function getMatrixUserLinkAction(
  data: GetMatrixUserLinkActionInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to get Matrix user link');
  }
  return await findLinkByPrivyUserId(data, { db });
}

export async function getAdminUserNameAction(
  data: GetAdminUserNameActionInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to get admin user name');
  }
  return await findAdminUserName(data, { db });
}

/** Batch map Privy subs → Matrix MXIDs for the mention picker (space roster merge). */
export async function getMatrixUserIdsByPrivySubsAction(
  {
    privyUserIds,
    environment,
  }: {
    privyUserIds: string[];
    environment: Environment;
  },
  { authToken }: { authToken?: string } = {},
): Promise<Array<{ privyUserId: string; matrixUserId: string }>> {
  if (!authToken) {
    throw new Error('authToken is required for matrix user id batch lookup');
  }
  return findMatrixUserIdsByPrivyUserIds({ privyUserIds, environment }, { db });
}

/** Batch map space roster person ids → Matrix MXIDs without exposing Privy subs. */
export async function getMatrixUserIdsByPersonIdsAction(
  {
    personIds,
    environment,
  }: {
    personIds: number[];
    environment: Environment;
  },
  { authToken }: { authToken?: string } = {},
): Promise<Array<{ personId: number; matrixUserId: string }>> {
  if (!authToken) {
    throw new Error('authToken is required for matrix user id batch lookup');
  }
  return findMatrixUserIdsByPersonIds({ personIds, environment }, { db });
}

export async function getLinkByMatrixUserIdAction(
  {
    matrixUserId,
    environment,
  }: {
    matrixUserId: string;
    environment: Environment;
  },
  { authToken }: { authToken?: string } = {},
) {
  if (!authToken) {
    throw new Error('authToken is required to get Matrix user link by ID');
  }
  return getLinkByMatrixUserId({ matrixUserId, environment });
}
