import { matrixUserLinks } from '@hypha-platform/storage-postgres';
import { DatabaseInstance } from '../../server';
import {
  CreateMatrixUserLinkInput,
  UpdateEncryptedAccessTokenInput,
} from '../types';
import { and, eq } from 'drizzle-orm';

export const createMatrixUserLink = async (
  {
    privyUserId,
    matrixUserId,
    encryptedAccessToken,
    deviceId,
    environment,
  }: CreateMatrixUserLinkInput,
  { db }: { db: DatabaseInstance },
) => {
  if (!privyUserId) {
    throw new Error('privyUserId is required to create Matrix user link');
  }
  if (!matrixUserId) {
    throw new Error('matrixUserId is required to create Matrix user link');
  }
  if (!encryptedAccessToken) {
    throw new Error(
      'encryptedAccessToken is required to create Matrix user link',
    );
  }
  const [newRecord] = await db
    .insert(matrixUserLinks)
    .values({
      privyUserId,
      matrixUserId,
      encryptedAccessToken,
      deviceId,
      environment,
    })
    .returning();

  if (!newRecord) {
    throw new Error('Failed to create Matrix user link');
  }

  return newRecord;
};

export const updateMatrixUserLink = async (
  {
    privyUserId,
    environment,
    encryptedAccessToken,
  }: UpdateEncryptedAccessTokenInput,
  { db }: { db: DatabaseInstance },
) => {
  const [updatedMatrixUserLink] = await db
    .update(matrixUserLinks)
    .set({ privyUserId, encryptedAccessToken })
    .where(
      and(
        eq(matrixUserLinks.environment, environment),
        eq(matrixUserLinks.privyUserId, privyUserId),
      ),
    )
    .returning();

  if (!updatedMatrixUserLink) {
    throw new Error('Failed to update Matrix user link encrypted access token');
  }

  return updatedMatrixUserLink;
};
