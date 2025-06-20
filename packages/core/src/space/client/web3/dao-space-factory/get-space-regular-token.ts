import {
  regularTokenFactoryAbi,
  regularTokenFactoryAddress,
} from '@core/generated';

export const getSpaceRegularToken = ({
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
