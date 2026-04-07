import {
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '@hypha-platform/core/generated';

export const getHasSpacePaid = ({
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
    functionName: 'hasSpacePaid',
    args: [spaceId],
  } as const;
};
