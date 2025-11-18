'use server';

import { db } from '@hypha-platform/storage-postgres';
import { createTransfer } from './mutations';
import { CreateTransferInput } from '../types';

export async function createTransferAction(
  data: CreateTransferInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create transfer');
  return createTransfer({ ...data }, { db });
}
