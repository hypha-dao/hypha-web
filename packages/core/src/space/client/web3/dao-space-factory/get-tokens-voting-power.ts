import {
  tokenVotingPowerImplementationAbi,
  tokenVotingPowerImplementationAddress,
} from '@hypha-platform/core/generated';

export const getTokensVotingPower = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof tokenVotingPowerImplementationAddress;
}) => {
  const address = tokenVotingPowerImplementationAddress[chain];

  return {
    address,
    abi: tokenVotingPowerImplementationAbi,
    functionName: 'spaceTokens',
    args: [spaceId],
  } as const;
};
