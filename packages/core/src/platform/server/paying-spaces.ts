import 'server-only';

import {
  hyphaTokenAbi,
  hyphaTokenAddress,
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '../../generated';
import { web3Client } from '../../common/server/web3-rpc/client';
import type { DbConfig } from '../../server';
import { spaces } from '@hypha-platform/storage-postgres';
import { and, asc, count, eq, gt, isNotNull, not, sql } from 'drizzle-orm';
import { formatUnits } from 'viem';

import type { SpaceActivationClassification } from '../types';

export type PayingSpaceStatus = {
  spaceId: number;
  web3SpaceId: number;
  slug: string;
  title: string;
  parentId: number | null;
  hasPaidWithHypha: boolean;
  isActive: boolean;
  expiryTime: number | null;
  freeTrialUsed: boolean;
  totalHyphaPaid: string;
  classification: SpaceActivationClassification;
  isEcosystem: boolean;
};

export type HyphaPaymentMonthBucket = {
  month: string;
  paymentCount: number;
  spacesActivated: number;
  spacesExpired: number;
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
    ecosystemSpaces: number;
    memberSpaces: number;
    hyphaPaidSpaces: number;
    activePaidSpaces: number;
    activeFreeTrialSpaces: number;
    expiredPaidSpaces: number;
    freeTrialOnly: number;
    expiringNext30Days: number;
    justExpired30Days: number;
    churnRatePct: number;
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
const TRACKED_SPACE_PAYMENT_BATCH_SIZE = 40;
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
    .where(trackedSpaceFilter());

  return Number(row?.total ?? 0);
}

function trackedSpaceFilter() {
  return and(
    eq(spaces.isArchived, false),
    isNotNull(spaces.web3SpaceId),
    gt(spaces.web3SpaceId, 0),
    not(sql`${spaces.flags} @> '["sandbox"]'::jsonb`),
    not(sql`${spaces.flags} @> '["archived"]'::jsonb`),
  );
}

async function countSpaceStructure({ db }: DbConfig) {
  const [row] = await db
    .select({
      ecosystems: sql<number>`count(*) filter (where ${spaces.parentId} is null)`,
      memberSpaces: sql<number>`count(*) filter (where ${spaces.parentId} is not null)`,
    })
    .from(spaces)
    .where(trackedSpaceFilter());

  return {
    ecosystemSpaces: Number(row?.ecosystems ?? 0),
    memberSpaces: Number(row?.memberSpaces ?? 0),
  };
}

async function listTrackedSpaces({ db }: DbConfig) {
  return db
    .select({
      id: spaces.id,
      slug: spaces.slug,
      title: spaces.title,
      web3SpaceId: spaces.web3SpaceId,
      parentId: spaces.parentId,
    })
    .from(spaces)
    .where(trackedSpaceFilter())
    .orderBy(asc(spaces.title));
}

function classifySpace(input: {
  hasPaidWithHypha: boolean;
  isActive: boolean;
  freeTrialUsed: boolean;
  totalHyphaPaid: string;
}): SpaceActivationClassification {
  const hyphaPaid =
    input.hasPaidWithHypha || Number.parseFloat(input.totalHyphaPaid) > 0;

  if (input.isActive) {
    if (hyphaPaid) return 'active_paid';
    if (input.freeTrialUsed) return 'free_trial';
    return 'inactive';
  }

  if (hyphaPaid) return 'expired_paid';
  if (input.freeTrialUsed) return 'free_trial';
  return 'inactive';
}

async function fetchPaymentStatesForSpaces(
  spacesToCheck: Array<{
    id: number;
    slug: string;
    title: string;
    web3SpaceId: number;
    parentId: number | null;
  }>,
  hyphaPaidByWeb3SpaceId: Map<number, bigint>,
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
      const totalHyphaPaid = formatUnits(
        hyphaPaidByWeb3SpaceId.get(space.web3SpaceId) ?? 0n,
        18,
      );
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
        const hasPaidWithHypha =
          hasPaid.status === 'success' ? Boolean(hasPaid.result) : false;
        const isActiveSpace =
          isActive.status === 'success' ? Boolean(isActive.result) : false;

        return {
          spaceId: space.id,
          web3SpaceId: space.web3SpaceId,
          slug: space.slug,
          title: space.title,
          parentId: space.parentId,
          hasPaidWithHypha,
          isActive: isActiveSpace,
          expiryTime,
          freeTrialUsed,
          totalHyphaPaid,
          isEcosystem: space.parentId == null,
          classification: classifySpace({
            hasPaidWithHypha,
            isActive: isActiveSpace,
            freeTrialUsed,
            totalHyphaPaid,
          }),
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
          parentId: space.parentId,
          hasPaidWithHypha: false,
          isActive: false,
          expiryTime: null,
          freeTrialUsed: false,
          totalHyphaPaid,
          isEcosystem: space.parentId == null,
          classification: classifySpace({
            hasPaidWithHypha: false,
            isActive: false,
            freeTrialUsed: false,
            totalHyphaPaid,
          }),
        } satisfies PayingSpaceStatus;
      }
    },
  );

  return batches;
}

async function computePayingSpacesMetrics({
  db,
}: DbConfig): Promise<PayingSpacesMetrics> {
  const [events, totalSpaces, spaceStructure, trackedSpaces] =
    await Promise.all([
      getHyphaPaymentEventsCached(),
      countTrackedSpaces({ db }),
      countSpaceStructure({ db }),
      listTrackedSpaces({ db }),
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

  const trackedForPayment = trackedSpaces
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
      parentId: space.parentId ?? null,
    }));

  const paymentStateBatches: PayingSpaceStatus[] = [];
  for (
    let i = 0;
    i < trackedForPayment.length;
    i += TRACKED_SPACE_PAYMENT_BATCH_SIZE
  ) {
    const batch = trackedForPayment.slice(
      i,
      i + TRACKED_SPACE_PAYMENT_BATCH_SIZE,
    );
    const batchStates = await fetchPaymentStatesForSpaces(
      batch,
      hyphaPaidByWeb3SpaceId,
    );
    paymentStateBatches.push(...batchStates);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const in30Days = nowSec + 30 * 86_400;
  const ago30Days = nowSec - 30 * 86_400;
  const expiredByMonth = new Map<string, number>();

  for (const space of paymentStateBatches) {
    if (
      !space.expiryTime ||
      space.expiryTime > nowSec ||
      space.classification !== 'expired_paid'
    ) {
      continue;
    }
    const month = toMonthKey(new Date(space.expiryTime * 1000));
    expiredByMonth.set(month, (expiredByMonth.get(month) ?? 0) + 1);
  }

  const monthly: HyphaPaymentMonthBucket[] = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      paymentCount: bucket.paymentCount,
      spacesActivated: bucket.spaceIds.size,
      spacesExpired: expiredByMonth.get(month) ?? 0,
      totalHypha: formatUnits(bucket.totalHypha, 18),
    }));

  const hyphaPaidSpaces = paymentStateBatches.filter(
    (space) =>
      space.classification === 'active_paid' ||
      space.classification === 'expired_paid' ||
      space.hasPaidWithHypha ||
      Number.parseFloat(space.totalHyphaPaid) > 0,
  );
  const activePaidSpaces = paymentStateBatches.filter(
    (space) => space.classification === 'active_paid',
  );
  const activeFreeTrialSpaces = paymentStateBatches.filter(
    (space) => space.classification === 'free_trial' && space.isActive,
  );
  const expiredPaidSpaces = paymentStateBatches.filter(
    (space) => space.classification === 'expired_paid',
  );
  const freeTrialOnly = paymentStateBatches.filter(
    (space) =>
      space.classification === 'free_trial' &&
      !space.hasPaidWithHypha &&
      Number.parseFloat(space.totalHyphaPaid) <= 0,
  ).length;
  const expiringNext30Days = hyphaPaidSpaces.filter(
    (space) =>
      space.isActive &&
      space.expiryTime != null &&
      space.expiryTime > nowSec &&
      space.expiryTime <= in30Days,
  ).length;
  const justExpired30Days = hyphaPaidSpaces.filter(
    (space) =>
      !space.isActive &&
      space.expiryTime != null &&
      space.expiryTime >= ago30Days &&
      space.expiryTime < nowSec,
  ).length;
  const churnRatePct =
    hyphaPaidSpaces.length > 0
      ? Math.round((expiredPaidSpaces.length / hyphaPaidSpaces.length) * 1000) /
        10
      : 0;

  return {
    summary: {
      totalSpaces,
      ecosystemSpaces: spaceStructure.ecosystemSpaces,
      memberSpaces: spaceStructure.memberSpaces,
      hyphaPaidSpaces: hyphaPaidSpaces.length,
      activePaidSpaces: activePaidSpaces.length,
      activeFreeTrialSpaces: activeFreeTrialSpaces.length,
      expiredPaidSpaces: expiredPaidSpaces.length,
      freeTrialOnly,
      expiringNext30Days,
      justExpired30Days,
      churnRatePct,
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
    spaces: hyphaPaidSpaces.sort((a, b) => {
      const aExpiry = a.expiryTime ?? Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expiryTime ?? Number.MAX_SAFE_INTEGER;
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      return aExpiry - bExpiry || a.title.localeCompare(b.title);
    }),
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
