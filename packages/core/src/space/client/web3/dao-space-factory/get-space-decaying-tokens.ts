import {
  decayingTokenFactoryAbi,
  decayingTokenFactoryAddress,
} from '@hypha-platform/core/generated';

export const getSpaceDecayingTokens = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof decayingTokenFactoryAddress;
}) => {
  const address = decayingTokenFactoryAddress[chain];

  return {
    address,
    abi: decayingTokenFactoryAbi,
    functionName: 'getSpaceToken',
    args: [spaceId],
  } as const;
};
