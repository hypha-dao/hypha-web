import {
  ownershipTokenFactoryAbi,
  ownershipTokenFactoryAddress,
} from '@hypha-platform/core/generated';

export const getSpaceOwnershipTokens = ({
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
