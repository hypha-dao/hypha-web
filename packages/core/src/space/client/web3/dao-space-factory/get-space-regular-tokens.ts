import {
  regularTokenFactoryAbi,
  regularTokenFactoryAddress,
} from '@hypha-platform/core/generated';

export const getSpaceRegularTokens = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof regularTokenFactoryAddress;
}) => {
  const address = regularTokenFactoryAddress[chain];

  return {
    address,
    abi: regularTokenFactoryAbi,
    functionName: 'getSpaceToken',
    args: [spaceId],
  } as const;
};
