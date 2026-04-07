import { transfers } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';
import { CreateTransferInput } from '../types';

export const createTransfer = async (
  transfer: CreateTransferInput,
  { db }: DbConfig,
) => {
  const [dbTransfer] = await db.insert(transfers).values(transfer).returning();
  if (!dbTransfer) {
    throw new Error('Failed to create transfer');
  }

  return dbTransfer;
};
