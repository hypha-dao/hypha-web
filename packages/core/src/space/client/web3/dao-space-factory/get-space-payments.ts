import {
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '@hypha-platform/core/generated';

export const getSpacePayments = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof spacePaymentTrackerAddress;
}) => {
  const address = spacePaymentTrackerAddress[chain];

  return {
    address,
    abi: spacePaymentTrackerAbi,
    functionName: 'spacePayments',
    args: [spaceId],
  } as const;
};
