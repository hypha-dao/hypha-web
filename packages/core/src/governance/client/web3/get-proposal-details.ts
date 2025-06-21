import { publicClient } from '@core/common/web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@core/generated';

export const getProposalDetails = async ({
  proposalId,
  chain = 8453,
}: {
  proposalId: bigint;
  chain?: keyof typeof daoProposalsImplementationAddress;
}) => {
  const address = daoProposalsImplementationAddress[chain];

  const [
    spaceId,
    startTime,
    endTime,
    executed,
    expired,
    yesVotes,
    noVotes,
    totalVotingPowerAtSnapshot,
    creator,
    transactions,
  ] = await publicClient.readContract({
    address,
    abi: daoProposalsImplementationAbi,
    functionName: 'getProposalCore',
    args: [proposalId],
  });

  return {
    spaceId,
    startTime,
    endTime,
    executed,
    expired,
    yesVotes,
    noVotes,
    totalVotingPowerAtSnapshot,
    creator,
    transactions,
  };
};
