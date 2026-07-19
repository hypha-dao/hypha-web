import 'server-only';

import {
  hyphaTokenAbi,
  hyphaTokenAddress,
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '../../generated';
import { findAllSpacesByWeb3SpaceIds } from '../../space/server/queries';
import { web3Client } from '../../common/server/web3-rpc/client';
import type { DbConfig } from '../../server';
import { spaces } from '@hypha-platform/storage-postgres';
import { and, count, eq, gt, isNotNull, not, sql } from 'drizzle-orm';
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

type HyphaPaymentEvent = {
  blockNumber: bigint;
  args: {
    spaceIds: readonly bigint[];
    durationInDays: readonly bigint[];
    totalHyphaUsed: bigint;
  };
};

type PayingSpacesMetrics = {
  summary: {
    totalSpaces: number;
    hyphaPaidSpaces: number;
    activePaidSpaces: number;
    expiredPaidSpaces: number;
    freeTrialOnly: number;
    totalHyphaBurned: string;
    paymentEventsInRange: number;
  };
  monthly: HyphaPaymentMonthBucket[];
  spaces: PayingSpaceStatus[];
};

const CHUNK_SIZE = 50_000n;
const BLOCKS_PER_DAY = 43_200n;
const HISTORY_DAYS = 365n;
const EVENT_CHUNK_CONCURRENCY = 12;
const BLOCK_FETCH_CONCURRENCY = 40;
const PAYMENT_STATE_BATCH_SIZE = 30;
const METRICS_CACHE_TTL_MS = 15 * 60 * 1000;
const EVENTS_CACHE_TTL_MS = 30 * 60 * 1000;

let metricsCache: { expiresAt: number; data: PayingSpacesMetrics } | null =
  null;
let eventsCache: { expiresAt: number; data: HyphaPaymentEvent[] } | null = null;
let metricsInFlight: Promise<PayingSpacesMetrics> | null = null;

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

function buildBlockChunks(fromBlock: bigint, currentBlock: bigint) {
  const chunks: Array<{ start: bigint; end: bigint }> = [];
  for (let start = fromBlock; start <= currentBlock; start += CHUNK_SIZE) {
    const end =
      start + CHUNK_SIZE - 1n > currentBlock
        ? currentBlock
        : start + CHUNK_SIZE - 1n;
    chunks.push({ start, end });
  }
  return chunks;
}

async function fetchHyphaPaymentEventsUncached(): Promise<HyphaPaymentEvent[]> {
  const tokenAddress = hyphaTokenAddress[8453] as `0x${string}`;
  const currentBlock = await web3Client.getBlockNumber();
  const fromBlock =
    currentBlock > BLOCKS_PER_DAY * HISTORY_DAYS
      ? currentBlock - BLOCKS_PER_DAY * HISTORY_DAYS
      : 0n;

  const chunks = buildBlockChunks(fromBlock, currentBlock);
  const chunkResults = await mapInBatches(
    chunks,
    EVENT_CHUNK_CONCURRENCY,
    async ({ start, end }) => {
      try {
        const chunk = await web3Client.getContractEvents({
          address: tokenAddress,
          abi: hyphaTokenAbi,
          eventName: 'SpacesPaymentProcessedWithHypha',
          fromBlock: start,
          toBlock: end,
        });
        const events: HyphaPaymentEvent[] = [];
        for (const event of chunk) {
          if (event.blockNumber == null || !('args' in event) || !event.args) {
            continue;
          }
          events.push({
            blockNumber: event.blockNumber,
            args: event.args as HyphaPaymentEvent['args'],
          });
        }
        return events;
      } catch (error) {
        console.warn(
          `[platform-dashboard] Failed Hypha payment log chunk ${start}-${end}`,
          error,
        );
        return [];
      }
    },
  );

  return chunkResults.flat();
}

async function getHyphaPaymentEventsCached(): Promise<HyphaPaymentEvent[]> {
  if (eventsCache && eventsCache.expiresAt > Date.now()) {
    return eventsCache.data;
  }

  const data = await fetchHyphaPaymentEventsUncached();
  eventsCache = {
    data,
    expiresAt: Date.now() + EVENTS_CACHE_TTL_MS,
  };
  return data;
}

export async function getHyphaPaymentEvents() {
  return getHyphaPaymentEventsCached();
}

async function countTrackedSpaces({ db }: DbConfig): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(spaces)
    .where(
      and(
        eq(spaces.isArchived, false),
        isNotNull(spaces.web3SpaceId),
        gt(spaces.web3SpaceId, 0),
        not(sql`${spaces.flags} @> '["sandbox"]'::jsonb`),
        not(sql`${spaces.flags} @> '["archived"]'::jsonb`),
      ),
    );

  return Number(row?.total ?? 0);
}

async function fetchPaymentStatesForSpaces(
  spacesToCheck: Array<{
    id: number;
    slug: string;
    title: string;
    web3SpaceId: number;
  }>,
): Promise<PayingSpaceStatus[]> {
  if (spacesToCheck.length === 0) {
    return [];
  }

  const trackerAddress = spacePaymentTrackerAddress[8453] as `0x${string}`;
  const batches = await mapInBatches(
    spacesToCheck,
    PAYMENT_STATE_BATCH_SIZE,
    async (space) => {
      const web3SpaceId = BigInt(space.web3SpaceId);
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
          web3SpaceId: space.web3SpaceId,
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
          web3SpaceId: space.web3SpaceId,
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

  return batches;
}

async function computePayingSpacesMetrics({
  db,
}: DbConfig): Promise<PayingSpacesMetrics> {
  const [events, totalSpaces] = await Promise.all([
    getHyphaPaymentEventsCached(),
    countTrackedSpaces({ db }),
  ]);

  const hyphaPaidByWeb3SpaceId = new Map<number, bigint>();
  const monthBuckets = new Map<
    string,
    { paymentCount: number; spaceIds: Set<number>; totalHypha: bigint }
  >();

  const uniqueBlockNumbers = [
    ...new Set(events.map((event) => event.blockNumber)),
  ];
  const blockTimestamps = new Map<bigint, number>();
  await mapInBatches(
    uniqueBlockNumbers,
    BLOCK_FETCH_CONCURRENCY,
    async (blockNumber) => {
      const block = await web3Client.getBlock({ blockNumber });
      blockTimestamps.set(blockNumber, Number(block.timestamp));
    },
  );

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

  const payingWeb3SpaceIds = [...hyphaPaidByWeb3SpaceId.entries()]
    .filter(([, amount]) => amount > 0n)
    .map(([web3SpaceId]) => web3SpaceId);

  const dbSpaces = await findAllSpacesByWeb3SpaceIds(
    { web3SpaceIds: payingWeb3SpaceIds, parentOnly: false },
    { db },
  );

  const paymentStates = await fetchPaymentStatesForSpaces(
    dbSpaces
      .filter(
        (space) =>
          space.web3SpaceId != null &&
          Number.isFinite(Number(space.web3SpaceId)) &&
          Number(space.web3SpaceId) > 0,
      )
      .map((space) => ({
        id: space.id,
        slug: space.slug,
        title: space.title,
        web3SpaceId: Number(space.web3SpaceId),
      })),
  );

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
    (space) =>
      space.hasPaidWithHypha || Number.parseFloat(space.totalHyphaPaid) > 0,
  );
  const activePaidSpaces = hyphaPaidSpaces.filter((space) => space.isActive);

  return {
    summary: {
      totalSpaces,
      hyphaPaidSpaces: hyphaPaidSpaces.length,
      activePaidSpaces: activePaidSpaces.length,
      expiredPaidSpaces: hyphaPaidSpaces.length - activePaidSpaces.length,
      freeTrialOnly: 0,
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
    spaces: hyphaPaidSpaces.sort((a, b) => a.title.localeCompare(b.title)),
  };
}

export async function getPayingSpacesMetrics({ db }: DbConfig) {
  if (metricsCache && metricsCache.expiresAt > Date.now()) {
    return metricsCache.data;
  }

  if (!metricsInFlight) {
    metricsInFlight = computePayingSpacesMetrics({ db })
      .then((data) => {
        metricsCache = {
          data,
          expiresAt: Date.now() + METRICS_CACHE_TTL_MS,
        };
        return data;
      })
      .finally(() => {
        metricsInFlight = null;
      });
  }

  return metricsInFlight;
}
