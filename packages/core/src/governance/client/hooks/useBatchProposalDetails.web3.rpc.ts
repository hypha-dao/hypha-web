import useSWR from 'swr';
import React from 'react';
import { publicClient } from '@core/common';
import { getProposalDetails } from '../web3';

export const useBatchProposalDetailsWeb3Rpc = ({
  proposalIds,
  quorumTotal = 100,
}: {
  proposalIds: number[];
  quorumTotal?: number;
}) => {
  const { data, error, isLoading } = useSWR(
    ['batchProposalDetails', proposalIds],
    async ([, ids]) => {
      const results = await Promise.all(
        ids.map((id) =>
          publicClient.readContract(
            getProposalDetails({ proposalId: BigInt(id) }),
          ),
        ),
      );
      return results;
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
    },
  );

  const parsedProposals = React.useMemo(() => {
    if (!data) return null;

    return data.map((d) => {
      if (!d) return null;

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
      ] = d;

      const totalVotingPowerNumber = Number(totalVotingPowerAtSnapshot);
      const quorumPercentage =
        quorumTotal > 0
          ? Math.min(100, (totalVotingPowerNumber / quorumTotal) * 100)
          : 0;

      return {
        creator,
        spaceId: Number(spaceId),
        executed,
        expired,
        startTime: new Date(Number(startTime) * 1000),
        endTime: new Date(Number(endTime) * 1000),
        yesVotes: Number(yesVotes),
        noVotes: Number(noVotes),
        totalVotingPowerAtSnapshot: totalVotingPowerNumber,
        yesVotePercentage:
          totalVotingPowerNumber > 0
            ? (Number(yesVotes) / totalVotingPowerNumber) * 100
            : 0,
        noVotePercentage:
          totalVotingPowerNumber > 0
            ? (Number(noVotes) / totalVotingPowerNumber) * 100
            : 0,
        quorumPercentage,
      };
    });
  }, [data, quorumTotal]);

  return {
    proposalsDetails: parsedProposals,
    isLoading,
    error,
  };
};
