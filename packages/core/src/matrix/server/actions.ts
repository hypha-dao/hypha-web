'use server';

import { db } from '@hypha-platform/storage-postgres';
import {
  CreateMatrixUserLinkInput,
  UpdateEncryptedAccessTokenInput,
} from '../types';
import { createMatrixUserLink, updateMatrixUserLink } from './mutations';

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
