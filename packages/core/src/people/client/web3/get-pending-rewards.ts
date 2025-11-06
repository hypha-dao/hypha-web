import {
  hyphaTokenAbi,
  hyphaTokenAddress,
} from '@hypha-platform/core/generated';

export const getPendingRewards = ({
  user,
  chain = 8453,
}: {
  user: `0x${string}`;
  chain?: keyof typeof hyphaTokenAddress;
}) => {
  const address = hyphaTokenAddress[chain];

  return {
    address,
    abi: hyphaTokenAbi,
    functionName: 'pendingRewards',
    args: [user],
  } as const;
};
