'use client';

import { publicClient } from '@core/common';
import useSWR from 'swr';
import { getProposalDetails } from '../web3';
import React from 'react';
import { decodeFunctionData, erc20Abi } from 'viem';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
  daoSpaceFactoryImplementationAbi,
  decayingSpaceTokenAbi,
  tokenBalanceJoinImplementationAbi,
} from '@core/generated';
import { TokenBase } from '@core/governance/types';

export const useProposalDetailsWeb3Rpc = ({
  proposalId,
}: {
  proposalId: number;
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

    const quorumTotalVotingPowerNumber = Number(totalVotingPowerAtSnapshot);
    const quorumPercentage =
      quorumTotalVotingPowerNumber > 0
        ? (Number(yesVotes + noVotes) / quorumTotalVotingPowerNumber) * 100
        : 0;

    const unityTotalVotingPowerNumber = Number(yesVotes) + Number(noVotes);
    const unityPercentage =
      unityTotalVotingPowerNumber > 0
        ? (Number(yesVotes) / unityTotalVotingPowerNumber) * 100
        : 0;

    const transfers: {
      recipient: string;
      rawAmount: bigint;
      token: string;
      value: bigint;
    }[] = [];

    const tokens: Array<{
      tokenType: 'regular' | 'ownership' | 'voice';
      spaceId: bigint;
      name: string;
      symbol: string;
      maxSupply: bigint;
      isVotingToken: boolean;
      transferable?: boolean;
      decayPercentage?: bigint;
      decayInterval?: bigint;
    }> = [];

    const votingMethods: Array<{
      spaceId: bigint;
      votingPowerSource: bigint;
      unity: bigint;
      quorum: bigint;
    }> = [];

    const mintings: Array<{
      member: `0x${string}`;
      number: bigint;
    }> = [];

    const entryMethods: Array<{
      spaceId: bigint;
      joinMethod: bigint;
    }> = [];

    const tokenRequirements: Array<{
      spaceId: bigint;
      token: `0x${string}`;
      amount: number;
    }> = [];

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
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }

      try {
        const decoded = decodeFunctionData({
          abi: regularTokenFactoryAbi,
          data: tx.data,
        });

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
            tokenType: 'regular',
            spaceId,
            name,
            symbol,
            maxSupply: initialSupply,
            isVotingToken,
            transferable,
          });
          return;
        }
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }

      try {
        const decoded = decodeFunctionData({
          abi: ownershipTokenFactoryAbi,
          data: tx.data,
        });

        if (decoded.functionName === 'deployOwnershipToken') {
          const [spaceId, name, symbol, maxSupply, isVotingToken] =
            decoded.args as unknown as [
              bigint,
              string,
              string,
              bigint,
              boolean,
            ];

          tokens.push({
            tokenType: 'ownership',
            spaceId,
            name,
            symbol,
            maxSupply,
            isVotingToken,
          });
          return;
        }
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }

      try {
        const decoded = decodeFunctionData({
          abi: decayingTokenFactoryAbi,
          data: tx.data,
        });

        if (decoded.functionName === 'deployDecayingToken') {
          const [
            spaceId,
            name,
            symbol,
            maxSupply,
            transferable,
            isVotingToken,
            decayPercentage,
            decayInterval,
          ] = decoded.args as unknown as [
            bigint,
            string,
            string,
            bigint,
            boolean,
            boolean,
            bigint,
            bigint,
          ];

          tokens.push({
            tokenType: 'voice',
            spaceId,
            name,
            symbol,
            maxSupply,
            isVotingToken,
            transferable,
            decayPercentage,
            decayInterval,
          });
        }
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }

      try {
        const decoded = decodeFunctionData({
          abi: daoSpaceFactoryImplementationAbi,
          data: tx.data,
        });

        if (decoded.functionName === 'changeVotingMethod') {
          const [spaceId, votingPowerSource, unity, quorum] =
            decoded.args as unknown as [bigint, bigint, bigint, bigint];

          votingMethods.push({
            spaceId,
            votingPowerSource,
            unity,
            quorum,
          });
        }
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }

      try {
        const decoded = decodeFunctionData({
          abi: decayingSpaceTokenAbi,
          data: tx.data,
        });

        if (decoded.functionName === 'mint') {
          const [member, number] = decoded.args as unknown as [
            `0x${string}`,
            bigint,
          ];

          mintings.push({
            member,
            number,
          });
        }
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }

      try {
        const decoded = decodeFunctionData({
          abi: daoSpaceFactoryImplementationAbi,
          data: tx.data,
        });

        if (decoded.functionName === 'changeEntryMethod') {
          const [spaceId, joinMethod] = decoded.args as unknown as [
            bigint,
            bigint,
          ];

          entryMethods.push({
            spaceId,
            joinMethod,
          });
        }
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }

      try {
        const decoded = decodeFunctionData({
          abi: tokenBalanceJoinImplementationAbi,
          data: tx.data,
        });

        if (decoded.functionName === 'setTokenRequirement') {
          const [spaceId, token, amount] = decoded.args as unknown as [
            bigint,
            `0x{string}`,
            number,
          ];

          tokenRequirements.push({
            spaceId,
            token,
            amount,
          });
        }
      } catch (error) {
        console.error('Failed to decode function data:', error);
      }
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
      totalVotingPowerAtSnapshot,
      quorumPercentage,
      unityPercentage,
      transfers,
      tokens,
      votingMethods,
      mintings,
      entryMethods,
      tokenRequirements,
    };
  }, [data]);

  return {
    proposalDetails: parsedProposal,
    isLoading,
    error,
  };
};
