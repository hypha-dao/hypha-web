import 'server-only';

import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '../../generated';
import { web3Client } from './web3-rpc/client';
import { mapInBatches, withRetries } from '../../platform/server/utils';

const VOTE_CHUNK_SIZE = 100_000n;
const VOTE_CHUNK_CONCURRENCY = 8;
const PROPOSALS_CHAIN_ID = 8453;

let creationBlockCache: bigint | null = null;

function proposalsAddress(): `0x${string}` {
  return daoProposalsImplementationAddress[PROPOSALS_CHAIN_ID];
}

function buildBlockChunks(fromBlock: bigint, currentBlock: bigint) {
  const chunks: Array<{ start: bigint; end: bigint }> = [];
  for (let start = fromBlock; start <= currentBlock; start += VOTE_CHUNK_SIZE) {
    const end =
      start + VOTE_CHUNK_SIZE - 1n > currentBlock
        ? currentBlock
        : start + VOTE_CHUNK_SIZE - 1n;
    chunks.push({ start, end });
  }
  return chunks;
}

async function findContractCreationBlock(
  address: `0x${string}`,
): Promise<bigint> {
  if (creationBlockCache != null) return creationBlockCache;

  const latest = await web3Client.getBlockNumber();
  let lo = 0n;
  let hi = latest;
  while (lo < hi) {
    const mid = lo + (hi - lo) / 2n;
    const code = await web3Client.getCode({ address, blockNumber: mid });
    if (code && code !== '0x') {
      hi = mid;
    } else {
      lo = mid + 1n;
    }
  }

  creationBlockCache = lo;
  return lo;
}

/**
 * Count on-chain proposal votes (`VoteCast`) on Base. Cached callers should
 * treat this as the voting slice of network Transactions.
 */
export async function countProposalVoteCasts(): Promise<number> {
  const address = proposalsAddress();
  const currentBlock = await web3Client.getBlockNumber();
  const fromBlock = await findContractCreationBlock(address);

  const readRange = (start: bigint, end: bigint) =>
    web3Client.getContractEvents({
      address,
      abi: daoProposalsImplementationAbi,
      eventName: 'VoteCast',
      fromBlock: start,
      toBlock: end,
    });

  try {
    const logs = await readRange(fromBlock, currentBlock);
    return logs.length;
  } catch (error) {
    console.warn(
      'Full-range VoteCast query failed; chunking from inception',
      error,
    );
  }

  const chunks = buildBlockChunks(fromBlock, currentBlock);
  const chunkCounts = await mapInBatches(
    chunks,
    VOTE_CHUNK_CONCURRENCY,
    async ({ start, end }) =>
      withRetries(async () => {
        const logs = await readRange(start, end);
        return logs.length;
      }),
  );
  return chunkCounts.reduce((sum, count) => sum + count, 0);
}
