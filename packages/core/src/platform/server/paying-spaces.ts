import 'server-only';

import { and, asc, eq, gt, isNotNull, not, sql } from 'drizzle-orm';
import { spaces } from '@hypha-platform/storage-postgres';

import {
  hyphaTokenAbi,
  hyphaTokenAddress,
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '../../generated';
import { web3Client } from '../../common/server/web3-rpc/client';
import type { DbConfig } from '../../common/server/types';
import {
  isPlaceholderPayingSpace,
  resolvedPayingSpaceTitle,
} from '../is-placeholder-space-title';
import {
  DEFAULT_HYPHA_PRICE_USD,
  allocateUsdByDuration,
  buildPayingSpacesTimeline,
  hyphaAmountToUsd,
  hyphaPriceAtBlock,
  roundUsd,
  usdcAmountToUsd,
  type HyphaPricePoint,
  type SpacePaymentEvent,
} from '../paying-spaces-timeline';
import type { PayingSpacesDashboardData } from '../types';
import { mapInBatches, withRetries } from './utils';

const CHUNK_SIZE = 100_000n;
const EVENT_CHUNK_CONCURRENCY = 8;
const BLOCK_FETCH_CONCURRENCY = 40;
const PAYMENT_STATE_BATCH_SIZE = 30;
const METRICS_CACHE_VERSION = 5;
const EVENTS_CACHE_VERSION = 2;
const PRICE_HISTORY_CACHE_VERSION = 1;
const METRICS_CACHE_TTL_MS = 15 * 60 * 1000;
const EVENTS_CACHE_TTL_MS = 30 * 60 * 1000;

type NormalizedPaymentLog = {
  blockNumber: bigint;
  spaceIds: readonly bigint[];
  durationInDays: readonly bigint[];
  usdcAmounts: readonly bigint[] | null;
  totalHyphaUsed: bigint | null;
};

type TrackedSpace = {
  id: number;
  slug: string;
  title: string;
  web3SpaceId: number;
};

let creationBlockCache: bigint | null = null;
let eventsCache: {
  version: number;
  expiresAt: number;
  data: NormalizedPaymentLog[];
} | null = null;
let priceHistoryCache: {
  version: number;
  expiresAt: number;
  data: HyphaPricePoint[];
} | null = null;
let metricsCache: {
  version: number;
  expiresAt: number;
  data: PayingSpacesDashboardData;
} | null = null;
let metricsInFlight: Promise<PayingSpacesDashboardData> | null = null;

function trackedSpaceFilter() {
  return and(
    eq(spaces.isArchived, false),
    isNotNull(spaces.web3SpaceId),
    gt(spaces.web3SpaceId, 0),
    not(sql`${spaces.flags} @> '["sandbox"]'::jsonb`),
    not(sql`${spaces.flags} @> '["archived"]'::jsonb`),
  );
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

function readPaymentLog(event: {
  blockNumber?: bigint | null;
  args?: unknown;
}): NormalizedPaymentLog | null {
  if (
    event.blockNumber == null ||
    event.args == null ||
    typeof event.args !== 'object'
  ) {
    return null;
  }
  const args = event.args as {
    spaceIds?: readonly bigint[];
    durationInDays?: readonly bigint[];
    usdcAmounts?: readonly bigint[];
    totalHyphaUsed?: bigint;
  };
  if (!args.spaceIds || !args.durationInDays) return null;
  return {
    blockNumber: event.blockNumber,
    spaceIds: args.spaceIds,
    durationInDays: args.durationInDays,
    usdcAmounts: Array.isArray(args.usdcAmounts) ? args.usdcAmounts : null,
    totalHyphaUsed:
      typeof args.totalHyphaUsed === 'bigint' ? args.totalHyphaUsed : null,
  };
}

function usdAmountsForLog(
  log: NormalizedPaymentLog,
  hyphaPriceUsd: bigint,
): number[] {
  const spaceIds = log.spaceIds.map((id) => Number(id));
  if (log.usdcAmounts) {
    return spaceIds.map((_, index) =>
      usdcAmountToUsd(log.usdcAmounts?.[index] ?? 0n),
    );
  }
  if (log.totalHyphaUsed != null) {
    return allocateUsdByDuration(
      spaceIds,
      log.durationInDays.map((days) => Number(days)),
      hyphaAmountToUsd(log.totalHyphaUsed, hyphaPriceUsd),
    );
  }
  return spaceIds.map(() => 0);
}

async function readHyphaPriceUsd(): Promise<bigint> {
  try {
    const tokenAddress = hyphaTokenAddress[8453] as `0x${string}`;
    const price = await withRetries(() =>
      web3Client.readContract({
        address: tokenAddress,
        abi: hyphaTokenAbi,
        functionName: 'HYPHA_PRICE_USD',
      }),
    );
    return price > 0n ? price : DEFAULT_HYPHA_PRICE_USD;
  } catch (error) {
    console.warn(
      '[paying-spaces] Failed to read HYPHA_PRICE_USD; using contract default',
      error,
    );
    return DEFAULT_HYPHA_PRICE_USD;
  }
}

async function fetchPaymentLogsUncached(): Promise<NormalizedPaymentLog[]> {
  const tokenAddress = hyphaTokenAddress[8453] as `0x${string}`;
  const currentBlock = await web3Client.getBlockNumber();
  const fromBlock = await findContractCreationBlock(tokenAddress);
  const eventNames = [
    'SpacesPaymentProcessed',
    'SpacesPaymentProcessedWithHypha',
  ] as const;

  const tryFullRange = async () => {
    const groups = await Promise.all(
      eventNames.map((eventName) =>
        web3Client.getContractEvents({
          address: tokenAddress,
          abi: hyphaTokenAbi,
          eventName,
          fromBlock,
          toBlock: currentBlock,
        }),
      ),
    );
    return groups.flat().flatMap((event) => {
      const parsed = readPaymentLog(event);
      return parsed ? [parsed] : [];
    });
  };

  try {
    return await tryFullRange();
  } catch (error) {
    console.warn(
      '[paying-spaces] Full-range payment log query failed; chunking from inception',
      error,
    );
  }

  const chunks = buildBlockChunks(fromBlock, currentBlock);
  const chunkResults = await mapInBatches(
    chunks,
    EVENT_CHUNK_CONCURRENCY,
    async ({ start, end }) =>
      withRetries(async () => {
        const groups = await Promise.all(
          eventNames.map((eventName) =>
            web3Client.getContractEvents({
              address: tokenAddress,
              abi: hyphaTokenAbi,
              eventName,
              fromBlock: start,
              toBlock: end,
            }),
          ),
        );
        return groups.flat().flatMap((event) => {
          const parsed = readPaymentLog(event);
          return parsed ? [parsed] : [];
        });
      }),
  );

  return chunkResults.flat();
}

async function getPaymentLogsCached(): Promise<NormalizedPaymentLog[]> {
  if (
    eventsCache &&
    eventsCache.version === EVENTS_CACHE_VERSION &&
    eventsCache.expiresAt > Date.now()
  ) {
    return eventsCache.data;
  }
  const data = await fetchPaymentLogsUncached();
  eventsCache = {
    version: EVENTS_CACHE_VERSION,
    data,
    expiresAt: Date.now() + EVENTS_CACHE_TTL_MS,
  };
  return data;
}

function readPriceUpdate(event: {
  blockNumber?: bigint | null;
  args?: unknown;
}): HyphaPricePoint | null {
  if (
    event.blockNumber == null ||
    event.args == null ||
    typeof event.args !== 'object'
  ) {
    return null;
  }
  const price = (event.args as { newHyphaPrice?: bigint }).newHyphaPrice;
  if (typeof price !== 'bigint' || price <= 0n) return null;
  return { blockNumber: event.blockNumber, hyphaPriceUsd: price };
}

async function fetchHyphaPriceHistoryUncached(): Promise<HyphaPricePoint[]> {
  const tokenAddress = hyphaTokenAddress[8453] as `0x${string}`;
  const currentBlock = await web3Client.getBlockNumber();
  const fromBlock = await findContractCreationBlock(tokenAddress);

  const collect = async (start: bigint, end: bigint) => {
    const events = await web3Client.getContractEvents({
      address: tokenAddress,
      abi: hyphaTokenAbi,
      eventName: 'PricingParametersUpdated',
      fromBlock: start,
      toBlock: end,
    });
    return events.flatMap((event) => {
      const parsed = readPriceUpdate(event);
      return parsed ? [parsed] : [];
    });
  };

  try {
    return (await collect(fromBlock, currentBlock)).sort((a, b) =>
      a.blockNumber < b.blockNumber
        ? -1
        : a.blockNumber > b.blockNumber
        ? 1
        : 0,
    );
  } catch (error) {
    console.warn(
      '[paying-spaces] Full-range price-history query failed; chunking from inception',
      error,
    );
  }

  const chunks = buildBlockChunks(fromBlock, currentBlock);
  const chunkResults = await mapInBatches(
    chunks,
    EVENT_CHUNK_CONCURRENCY,
    async ({ start, end }) => withRetries(() => collect(start, end)),
  );

  return chunkResults
    .flat()
    .sort((a, b) =>
      a.blockNumber < b.blockNumber
        ? -1
        : a.blockNumber > b.blockNumber
        ? 1
        : 0,
    );
}

async function getHyphaPriceHistoryCached(): Promise<HyphaPricePoint[]> {
  if (
    priceHistoryCache &&
    priceHistoryCache.version === PRICE_HISTORY_CACHE_VERSION &&
    priceHistoryCache.expiresAt > Date.now()
  ) {
    return priceHistoryCache.data;
  }
  const data = await fetchHyphaPriceHistoryUncached();
  priceHistoryCache = {
    version: PRICE_HISTORY_CACHE_VERSION,
    data,
    expiresAt: Date.now() + EVENTS_CACHE_TTL_MS,
  };
  return data;
}

async function listTrackedSpaces({ db }: DbConfig): Promise<TrackedSpace[]> {
  const rows = await db
    .select({
      id: spaces.id,
      slug: spaces.slug,
      title: spaces.title,
      web3SpaceId: spaces.web3SpaceId,
    })
    .from(spaces)
    .where(trackedSpaceFilter())
    .orderBy(asc(spaces.title));

  return rows
    .filter(
      (row): row is typeof row & { web3SpaceId: number } =>
        row.web3SpaceId != null &&
        Number.isFinite(Number(row.web3SpaceId)) &&
        Number(row.web3SpaceId) > 0,
    )
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      web3SpaceId: Number(row.web3SpaceId),
    }));
}

async function fetchPaymentStates(tracked: TrackedSpace[]): Promise<
  Array<{
    space: TrackedSpace;
    hasPaid: boolean;
    isActive: boolean;
    expiryTime: number | null;
    freeTrialUsed: boolean;
  }>
> {
  const trackerAddress = spacePaymentTrackerAddress[8453] as `0x${string}`;
  return mapInBatches(tracked, PAYMENT_STATE_BATCH_SIZE, async (space) => {
    const web3SpaceId = BigInt(space.web3SpaceId);
    return withRetries(async () => {
      const [hasPaid, payment, isActive] = await web3Client.multicall({
        allowFailure: false,
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

      if (
        hasPaid === undefined ||
        payment === undefined ||
        isActive === undefined
      ) {
        throw new Error(
          `[paying-spaces] Incomplete payment-state multicall for space ${space.slug}`,
        );
      }

      return {
        space,
        hasPaid: Boolean(hasPaid),
        isActive: Boolean(isActive),
        expiryTime: Number(payment[0]),
        freeTrialUsed: Boolean(payment[1]),
      };
    });
  });
}

async function computePayingSpacesMetrics({
  db,
}: DbConfig): Promise<PayingSpacesDashboardData> {
  const [logs, trackedSpaces, currentHyphaPriceUsd, hyphaPriceHistory] =
    await Promise.all([
      getPaymentLogsCached(),
      listTrackedSpaces({ db }),
      readHyphaPriceUsd(),
      getHyphaPriceHistoryCached(),
    ]);

  const uniqueBlockNumbers = [
    ...new Set(logs.map((event) => event.blockNumber)),
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

  const initialHyphaPriceUsd =
    hyphaPriceHistory.length === 0
      ? currentHyphaPriceUsd
      : DEFAULT_HYPHA_PRICE_USD;

  const events: SpacePaymentEvent[] = [];
  for (const log of logs) {
    const timestampSec = blockTimestamps.get(log.blockNumber) ?? 0;
    const hyphaPriceUsd = hyphaPriceAtBlock(
      hyphaPriceHistory,
      log.blockNumber,
      initialHyphaPriceUsd,
    );
    const usdAmounts = usdAmountsForLog(log, hyphaPriceUsd);
    for (let index = 0; index < log.spaceIds.length; index += 1) {
      events.push({
        timestampSec,
        spaceId: Number(log.spaceIds[index]),
        durationDays: Number(log.durationInDays[index] ?? 0n),
        usdAmount: usdAmounts[index] ?? 0,
      });
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const titleByWeb3Id = new Map(
    trackedSpaces.map((space) => [space.web3SpaceId, space.title]),
  );
  const resolvedTitle = (web3SpaceId: number) =>
    resolvedPayingSpaceTitle(titleByWeb3Id.get(web3SpaceId), web3SpaceId);
  const isIncludedWeb3Id = (web3SpaceId: number) =>
    !isPlaceholderPayingSpace({
      title: titleByWeb3Id.get(web3SpaceId),
      web3SpaceId,
    });

  const trackedForDashboard = trackedSpaces.filter((space) =>
    isIncludedWeb3Id(space.web3SpaceId),
  );
  const eventsForDashboard = events.filter((event) =>
    isIncludedWeb3Id(event.spaceId),
  );

  const timeline = buildPayingSpacesTimeline({
    events: eventsForDashboard,
    nowSec,
  });
  const paymentStates = await fetchPaymentStates(trackedForDashboard);
  const trackedByWeb3Id = new Map(
    paymentStates.map((row) => [row.space.web3SpaceId, row]),
  );

  const paidWeb3Ids = new Set<number>([
    ...timeline.bySpace.map((row) => row.spaceId),
    ...paymentStates
      .filter((row) => row.hasPaid)
      .map((row) => row.space.web3SpaceId),
  ]);

  const spacesForDashboard = [...paidWeb3Ids]
    .sort((a, b) => a - b)
    .filter((web3SpaceId) => isIncludedWeb3Id(web3SpaceId))
    .map((web3SpaceId) => {
      const tracked = trackedByWeb3Id.get(web3SpaceId);
      const hasPaid = tracked?.hasPaid ?? true;
      const currentlyPaying = Boolean(tracked?.isActive && hasPaid);
      return {
        web3SpaceId,
        spaceId: tracked?.space.id ?? null,
        slug: tracked?.space.slug ?? null,
        title: resolvedTitle(web3SpaceId),
        currentlyPaying,
        hasPaid,
        expiryTime: tracked?.expiryTime ?? null,
        freeTrialUsed: tracked?.freeTrialUsed ?? false,
      };
    })
    .sort((a, b) => {
      if (a.currentlyPaying !== b.currentlyPaying) {
        return a.currentlyPaying ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });

  const monthly = timeline.months.map((month, index) => ({
    month,
    payingSpaces: timeline.payingCount[index] ?? 0,
    paymentCount: timeline.paymentCount[index] ?? 0,
    paymentUsd: timeline.paymentUsd[index] ?? 0,
    spaces: timeline.bySpace
      .map((series) => ({
        web3SpaceId: series.spaceId,
        paying: series.paying[index] ?? false,
        paymentCount: series.paymentCount[index] ?? 0,
        paymentUsd: series.paymentUsd[index] ?? 0,
      }))
      .filter(
        (row) => row.paying || row.paymentCount > 0 || row.paymentUsd > 0,
      ),
  }));

  return {
    generatedAt: new Date().toISOString(),
    fromMonth: timeline.months[0] ?? null,
    summary: {
      currentlyPaying: paymentStates.filter(
        (row) => row.isActive && row.hasPaid,
      ).length,
      everPaid: spacesForDashboard.length,
      trackedSpaces: trackedForDashboard.length,
      paymentEvents: eventsForDashboard.length,
      paymentUsd: roundUsd(
        eventsForDashboard.reduce(
          (sum, event) => sum + (event.usdAmount ?? 0),
          0,
        ),
      ),
    },
    monthly,
    spaces: spacesForDashboard,
  };
}

export async function getPayingSpacesMetrics({
  db,
}: DbConfig): Promise<PayingSpacesDashboardData> {
  if (
    metricsCache &&
    metricsCache.version === METRICS_CACHE_VERSION &&
    metricsCache.expiresAt > Date.now()
  ) {
    return metricsCache.data;
  }

  if (!metricsInFlight) {
    metricsInFlight = computePayingSpacesMetrics({ db })
      .then((data) => {
        metricsCache = {
          version: METRICS_CACHE_VERSION,
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
