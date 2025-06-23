import {
  ownershipTokenFactoryAbi,
  ownershipTokenFactoryAddress,
} from '@core/generated';

export const getSpaceOwnershipToken = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof ownershipTokenFactoryAddress;
}) => {
  const address = ownershipTokenFactoryAddress[chain];

  return {
    address,
    abi: ownershipTokenFactoryAbi,
    functionName: 'getSpaceToken',
    args: [spaceId],
  } as const;
};
