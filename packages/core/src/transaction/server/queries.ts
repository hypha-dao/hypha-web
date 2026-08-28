import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { transfers } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

type FindAllTransfersProps = {
  transactionHash?: string;
  memo?: string;
};

const TRANSFER_HASH_BATCH_SIZE = 100;

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

export const findTransfersByTransactionHashes = async (
  { db }: DbConfig,
  transactionHashes: string[],
) => {
  const uniqueHashes = Array.from(
    new Set(
      transactionHashes
        .map((hash) => hash.trim().toLowerCase())
        .filter((hash) => hash.length > 0),
    ),
  );
  if (uniqueHashes.length === 0) {
    return [];
  }

  const results: Array<{
    id: number;
    transactionHash: string;
    memo: string | null;
  }> = [];

  for (let index = 0; index < uniqueHashes.length; index += TRANSFER_HASH_BATCH_SIZE) {
    const batch = uniqueHashes.slice(index, index + TRANSFER_HASH_BATCH_SIZE);
    const rows = await db
      .select({
        id: transfers.id,
        transactionHash: transfers.transactionHash,
        memo: transfers.memo,
      })
      .from(transfers)
      .where(inArray(sql`lower(${transfers.transactionHash})`, batch));
    results.push(...rows);
  }

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
