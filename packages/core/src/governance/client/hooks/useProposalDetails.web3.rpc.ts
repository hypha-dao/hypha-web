'use client';

import { publicClient } from '@core/common';
import useSWR from 'swr';
import { getProposalDetails } from '../web3';
import React from 'react';
import { decodeFunctionData, erc20Abi } from 'viem';
import { regularTokenFactoryAbi } from '@core/generated';

export const useProposalDetailsWeb3Rpc = ({
  proposalId,
  quorumTotal = 100,
}: {
  proposalId: number;
  quorumTotal?: number;
}) => {
  const { data, isLoading, error } = useSWR(
    [proposalId, 'proposalDetails'],
    async ([proposalId]) =>
      publicClient.readContract(
        getProposalDetails({ proposalId: BigInt(proposalId) }),
      ),
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
    },
  );

  const parsedProposal = React.useMemo(() => {
    if (!data) return null;

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
    ] = data;

    const totalVotingPowerNumber = Number(totalVotingPowerAtSnapshot);
    const quorumPercentage =
      quorumTotal > 0
        ? Math.min(100, (totalVotingPowerNumber / quorumTotal) * 100)
        : 0;

    const transfers: {
      recipient: string;
      rawAmount: bigint;
      token: string;
      value: bigint;
    }[] = [];

    const tokens: {
      spaceId: bigint;
      name: string;
      symbol: string;
      initialSupply: bigint;
      transferable: boolean;
      isVotingToken: boolean;
    }[] = [];

    (transactions as any[]).forEach((tx) => {
      try {
        const decoded = decodeFunctionData({
          abi: erc20Abi,
          data: tx.data,
        });

        if (decoded.functionName === 'transfer') {
          transfers.push({
            recipient: decoded.args?.[0] as string,
            rawAmount: decoded.args?.[1] as bigint,
            token: tx.target,
            value: tx.value,
          });
          return;
        }
      } catch {}

      try {
        const decoded = decodeFunctionData({
          abi: regularTokenFactoryAbi,
          data: tx.data,
        });
        console.log(decoded);
        if (decoded.functionName === 'deployToken') {
          const [
            spaceId,
            name,
            symbol,
            initialSupply,
            transferable,
            isVotingToken,
          ] = decoded.args as unknown as [
            bigint,
            string,
            string,
            bigint,
            boolean,
            boolean,
          ];

          tokens.push({
            spaceId,
            name,
            symbol,
            initialSupply,
            transferable,
            isVotingToken,
          });
        }
      } catch {}
    });

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
      transfers,
      tokens,
    };
  }, [data, quorumTotal]);

  return {
    proposalDetails: parsedProposal,
    isLoading,
    error,
  };
};
