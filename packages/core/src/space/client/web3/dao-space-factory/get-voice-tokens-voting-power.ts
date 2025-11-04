import {
  voteDecayTokenVotingPowerImplementationAbi,
  voteDecayTokenVotingPowerImplementationAddress,
} from '@hypha-platform/core/generated';

export const getVoiceTokensVotingPower = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof voteDecayTokenVotingPowerImplementationAddress;
}) => {
  const address = voteDecayTokenVotingPowerImplementationAddress[chain];

  return {
    address,
    abi: voteDecayTokenVotingPowerImplementationAbi,
    functionName: 'spaceTokens',
    args: [spaceId],
  } as const;
};
