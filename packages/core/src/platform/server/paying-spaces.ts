import 'server-only';

import {
  hyphaTokenAbi,
  hyphaTokenAddress,
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '../../generated';
import { findAllSpaces } from '../../space/server/queries';
import { web3Client } from '../../common/server/web3-rpc/client';
import type { DbConfig } from '../../server';
import { formatUnits } from 'viem';

export type PayingSpaceStatus = {
  spaceId: number;
  web3SpaceId: number;
  slug: string;
  title: string;
  hasPaidWithHypha: boolean;
  isActive: boolean;
  expiryTime: number | null;
  freeTrialUsed: boolean;
  totalHyphaPaid: string;
};

export type HyphaPaymentMonthBucket = {
  month: string;
  paymentCount: number;
  spacesActivated: number;
  totalHypha: string;
};

const CHUNK_SIZE = 50_000n;
const BLOCKS_PER_DAY = 43_200n;
const HISTORY_DAYS = 365n;

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getHyphaPaymentEvents() {
  const tokenAddress = hyphaTokenAddress[8453] as `0x${string}`;
  const currentBlock = await web3Client.getBlockNumber();
  const fromBlock =
    currentBlock > BLOCKS_PER_DAY * HISTORY_DAYS
      ? currentBlock - BLOCKS_PER_DAY * HISTORY_DAYS
      : 0n;

  type HyphaPaymentEvent = {
    blockNumber: bigint;
    args: {
      spaceIds: readonly bigint[];
      durationInDays: readonly bigint[];
      totalHyphaUsed: bigint;
    };
  };

  const allEvents: HyphaPaymentEvent[] = [];

  for (let start = fromBlock; start <= currentBlock; start += CHUNK_SIZE) {
    const end =
      start + CHUNK_SIZE - 1n > currentBlock
        ? currentBlock
        : start + CHUNK_SIZE - 1n;
    try {
      const chunk = await web3Client.getContractEvents({
        address: tokenAddress,
        abi: hyphaTokenAbi,
        eventName: 'SpacesPaymentProcessedWithHypha',
        fromBlock: start,
        toBlock: end,
      });
      for (const event of chunk) {
        if (event.blockNumber == null || !('args' in event) || !event.args) {
          continue;
        }
        allEvents.push({
          blockNumber: event.blockNumber,
          args: event.args as HyphaPaymentEvent['args'],
        });
      }
    } catch (error) {
      console.warn(
        `[platform-dashboard] Failed Hypha payment log chunk ${start}-${end}`,
        error,
      );
    }
  }

  return allEvents;
}

export async function getPayingSpacesMetrics({ db }: DbConfig) {
  const spaces = await findAllSpaces(
    { db },
    { parentOnly: false, omitSandbox: true, omitArchived: true },
  );
  const spacesWithWeb3 = spaces.filter(
    (space) =>
      space.web3SpaceId != null &&
      Number.isFinite(Number(space.web3SpaceId)) &&
      Number(space.web3SpaceId) > 0,
  );

  const trackerAddress = spacePaymentTrackerAddress[8453] as `0x${string}`;

  const paymentStates = await mapInBatches(
    spacesWithWeb3,
    40,
    async (space) => {
      const web3SpaceId = BigInt(space.web3SpaceId as number);
      try {
        const [hasPaid, payment, isActive] = await web3Client.multicall({
          contracts: [
            {
              address: trackerAddress,
              abi: spacePaymentTrackerAbi,
              functionName: 'hasSpacePaid',
              args: [web3SpaceId],
            },
            {
              address: trackerAddress,
              abi: spacePaymentTrackerAbi,
              functionName: 'spacePayments',
              args: [web3SpaceId],
            },
            {
              address: trackerAddress,
              abi: spacePaymentTrackerAbi,
              functionName: 'isSpaceActive',
              args: [web3SpaceId],
            },
          ],
        });

        const expiryTime =
          payment.status === 'success' ? Number(payment.result[0]) : null;
        const freeTrialUsed =
          payment.status === 'success' ? Boolean(payment.result[1]) : false;

        return {
          spaceId: space.id,
          web3SpaceId: Number(space.web3SpaceId),
          slug: space.slug,
          title: space.title,
          hasPaidWithHypha:
            hasPaid.status === 'success' ? Boolean(hasPaid.result) : false,
          isActive:
            isActive.status === 'success' ? Boolean(isActive.result) : false,
          expiryTime,
          freeTrialUsed,
          totalHyphaPaid: '0',
        } satisfies PayingSpaceStatus;
      } catch (error) {
        console.warn(
          `[platform-dashboard] Failed payment state for space ${space.slug}`,
          error,
        );
        return {
          spaceId: space.id,
          web3SpaceId: Number(space.web3SpaceId),
          slug: space.slug,
          title: space.title,
          hasPaidWithHypha: false,
          isActive: false,
          expiryTime: null,
          freeTrialUsed: false,
          totalHyphaPaid: '0',
        } satisfies PayingSpaceStatus;
      }
    },
  );

  const events = await getHyphaPaymentEvents();
  const hyphaPaidByWeb3SpaceId = new Map<number, bigint>();
  const monthBuckets = new Map<
    string,
    { paymentCount: number; spaceIds: Set<number>; totalHypha: bigint }
  >();

  const uniqueBlockNumbers = [
    ...new Set(events.map((event) => event.blockNumber)),
  ];
  const blockTimestamps = new Map<bigint, number>();
  await mapInBatches(uniqueBlockNumbers, 25, async (blockNumber) => {
    const block = await web3Client.getBlock({ blockNumber });
    blockTimestamps.set(blockNumber, Number(block.timestamp));
  });

  for (const event of events) {
    const { spaceIds, durationInDays, totalHyphaUsed } = event.args;
    const totalDays = durationInDays.reduce((sum, days) => sum + days, 0n);
    const timestamp = blockTimestamps.get(event.blockNumber) ?? 0;
    const month = toMonthKey(new Date(timestamp * 1000));

    const bucket = monthBuckets.get(month) ?? {
      paymentCount: 0,
      spaceIds: new Set<number>(),
      totalHypha: 0n,
    };
    bucket.paymentCount += 1;
    bucket.totalHypha += totalHyphaUsed;

    for (let index = 0; index < spaceIds.length; index += 1) {
      const id = Number(spaceIds[index]);
      const duration = durationInDays[index] ?? 0n;
      const share =
        totalDays > 0n
          ? (totalHyphaUsed * duration) / totalDays
          : spaceIds.length > 0
          ? totalHyphaUsed / BigInt(spaceIds.length)
          : 0n;
      bucket.spaceIds.add(id);
      hyphaPaidByWeb3SpaceId.set(
        id,
        (hyphaPaidByWeb3SpaceId.get(id) ?? 0n) + share,
      );
    }
    monthBuckets.set(month, bucket);
  }

  const spacesWithTotals = paymentStates.map((space) => ({
    ...space,
    totalHyphaPaid: formatUnits(
      hyphaPaidByWeb3SpaceId.get(space.web3SpaceId) ?? 0n,
      18,
    ),
  }));

  const monthly: HyphaPaymentMonthBucket[] = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      paymentCount: bucket.paymentCount,
      spacesActivated: bucket.spaceIds.size,
      totalHypha: formatUnits(bucket.totalHypha, 18),
    }));

  const hyphaPaidSpaces = spacesWithTotals.filter(
    (space) => space.hasPaidWithHypha,
  );
  const activePaidSpaces = hyphaPaidSpaces.filter((space) => space.isActive);

  return {
    summary: {
      totalSpaces: spacesWithWeb3.length,
      hyphaPaidSpaces: hyphaPaidSpaces.length,
      activePaidSpaces: activePaidSpaces.length,
      expiredPaidSpaces: hyphaPaidSpaces.length - activePaidSpaces.length,
      freeTrialOnly: spacesWithTotals.filter(
        (space) => space.freeTrialUsed && !space.hasPaidWithHypha,
      ).length,
      totalHyphaBurned: formatUnits(
        [...hyphaPaidByWeb3SpaceId.values()].reduce(
          (sum, value) => sum + value,
          0n,
        ),
        18,
      ),
      paymentEventsInRange: events.length,
    },
    monthly,
    spaces: spacesWithTotals.sort((a, b) =>
      a.hasPaidWithHypha === b.hasPaidWithHypha
        ? a.title.localeCompare(b.title)
        : a.hasPaidWithHypha
        ? -1
        : 1,
    ),
  };
}
