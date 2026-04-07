import { and, asc, eq } from 'drizzle-orm';
import { transfers } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

type FindAllTransfersProps = {
  transactionHash?: string;
  memo?: string;
};

export const findAllTransfers = async (
  { db }: DbConfig,
  { transactionHash, memo }: FindAllTransfersProps = {},
) => {
  const whereConditions = [];

  if (transactionHash) {
    whereConditions.push(eq(transfers.transactionHash, transactionHash));
  }
  if (memo) {
    whereConditions.push(eq(transfers.memo, memo));
  }

  const results = await db
    .select({
      id: transfers.id,
      transactionHash: transfers.transactionHash,
      memo: transfers.memo,
    })
    .from(transfers)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(asc(transfers.id));

  return results;
};

export const findTransferByTransactionHash = async (
  transactionHash: string,
  { db }: DbConfig,
) => {
  const [transfer] = await db
    .select()
    .from(transfers)
    .where(eq(transfers.transactionHash, transactionHash));

  return transfer || null;
};
