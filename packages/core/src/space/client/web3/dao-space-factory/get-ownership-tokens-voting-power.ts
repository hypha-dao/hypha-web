import {
  ownershipTokenVotingPowerImplementationAbi,
  ownershipTokenVotingPowerImplementationAddress,
} from '@hypha-platform/core/generated';

export const getOwnershipTokensVotingPower = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof ownershipTokenVotingPowerImplementationAddress;
}) => {
  const address = ownershipTokenVotingPowerImplementationAddress[chain];

  return {
    address,
    abi: ownershipTokenVotingPowerImplementationAbi,
    functionName: 'spaceTokens',
    args: [spaceId],
  } as const;
};
