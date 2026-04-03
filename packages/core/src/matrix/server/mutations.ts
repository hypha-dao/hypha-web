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
  if (!environment) {
    throw new Error('environment is required to create Matrix user link');
  }
  try {
    const [newRecord] = await db
      .insert(matrixUserLinks)
      .values({
        privyUserId,
        matrixUserId,
        encryptedAccessToken,
        deviceId,
        environment,
      })
      .onConflictDoUpdate({
        target: [matrixUserLinks.environment, matrixUserLinks.privyUserId],
        set: {
          encryptedAccessToken,
          matrixUserId,
          deviceId,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!newRecord) {
      throw new Error('Failed to create Matrix user link');
    }

    return newRecord;
  } catch (error) {
    const dbError = error as { code?: string; constraint?: string };
    if (
      dbError.code === '23505' &&
      dbError.constraint?.includes('matrix_user_links_env_matrix')
    ) {
      throw new Error(
        `Matrix user '${matrixUserId}' is already linked to another account in this environment`,
      );
    }
    throw error;
  }
};

export const updateMatrixUserLink = async (
  {
    privyUserId,
    environment,
    encryptedAccessToken,
    deviceId,
  }: UpdateEncryptedAccessTokenInput,
  { db }: { db: DatabaseInstance },
) => {
  if (!privyUserId) {
    throw new Error('privyUserId is required to update Matrix user link');
  }
  if (!environment) {
    throw new Error('environment is required to update Matrix user link');
  }
  if (!encryptedAccessToken) {
    throw new Error(
      'encryptedAccessToken is required to update Matrix user link',
    );
  }
  const [updatedMatrixUserLink] = await db
    .update(matrixUserLinks)
    .set({
      encryptedAccessToken,
      ...(deviceId !== undefined ? { deviceId } : {}),
      updatedAt: new Date(),
    })
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
