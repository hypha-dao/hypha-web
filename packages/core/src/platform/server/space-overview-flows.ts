import 'server-only';

import {
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '../../generated';
import { web3Client } from '../../common/server/web3-rpc/client';
import type { DbConfig } from '../../server';
import { formatUnits } from 'viem';
import { getHyphaPaymentEvents } from './paying-spaces';
import { toMonthKey } from './utils';

export async function getSpaceOverviewFlows(
  { db: _db }: DbConfig,
  space: {
    slug: string;
    title: string;
    web3SpaceId: number;
  },
) {
  const web3SpaceId = BigInt(space.web3SpaceId);
  const trackerAddress = spacePaymentTrackerAddress[8453] as `0x${string}`;

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

  const events = await getHyphaPaymentEvents();
  const monthBuckets = new Map<
    string,
    { paymentCount: number; totalHypha: bigint }
  >();
  let paymentEventsInRange = 0;
  let totalHyphaPaid = 0n;

  const uniqueBlockNumbers = [
    ...new Set(events.map((event) => event.blockNumber)),
  ];
  const blockTimestamps = new Map<bigint, number>();
  for (const blockNumber of uniqueBlockNumbers) {
    const block = await web3Client.getBlock({ blockNumber });
    blockTimestamps.set(blockNumber, Number(block.timestamp));
  }

  for (const event of events) {
    const { spaceIds, durationInDays, totalHyphaUsed } = event.args;
    const spaceIndex = spaceIds.findIndex(
      (id) => Number(id) === space.web3SpaceId,
    );
    if (spaceIndex < 0) {
      continue;
    }

    paymentEventsInRange += 1;
    const totalDays = durationInDays.reduce((sum, days) => sum + days, 0n);
    const duration = durationInDays[spaceIndex] ?? 0n;
    const share =
      totalDays > 0n
        ? (totalHyphaUsed * duration) / totalDays
        : spaceIds.length > 0
        ? totalHyphaUsed / BigInt(spaceIds.length)
        : 0n;
    totalHyphaPaid += share;

    const timestamp = blockTimestamps.get(event.blockNumber) ?? 0;
    const month = toMonthKey(new Date(timestamp * 1000));
    const bucket = monthBuckets.get(month) ?? {
      paymentCount: 0,
      totalHypha: 0n,
    };
    bucket.paymentCount += 1;
    bucket.totalHypha += share;
    monthBuckets.set(month, bucket);
  }

  const monthly = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      paymentCount: bucket.paymentCount,
      totalHypha: formatUnits(bucket.totalHypha, 18),
    }));

  return {
    status: {
      hasPaidWithHypha:
        hasPaid.status === 'success' ? Boolean(hasPaid.result) : false,
      isActive:
        isActive.status === 'success' ? Boolean(isActive.result) : false,
      expiryTime,
      freeTrialUsed,
      totalHyphaPaid: formatUnits(totalHyphaPaid, 18),
    },
    summary: {
      paymentEventsInRange,
      monthlyPaymentCount: monthly.reduce(
        (sum, bucket) => sum + bucket.paymentCount,
        0,
      ),
    },
    monthly,
  };
}
