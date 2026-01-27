'use server';

import { db } from '@hypha-platform/storage-postgres';
import {
  CreateMatrixUserLinkInput,
  GetMatrixUserLinkActionInput,
  UpdateEncryptedAccessTokenInput,
} from '../types';
import { createMatrixUserLink, updateMatrixUserLink } from './mutations';
import { findLinkByPrivyUserId } from './queries';

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
