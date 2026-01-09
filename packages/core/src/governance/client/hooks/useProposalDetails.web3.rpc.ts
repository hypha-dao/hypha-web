'use client';

import { publicClient } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { getProposalDetails } from '../web3';
import React from 'react';
import { decodeTransaction } from './decoders';

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
      isVotingToken?: boolean;
      transferable?: boolean;
      fixedMaxSupply?: boolean;
      autoMinting?: boolean;
      priceInUSD?: bigint;
      useTransferWhitelist?: boolean;
      useReceiveWhitelist?: boolean;
      initialTransferWhitelist?: `0x${string}`[];
      initialReceiveWhitelist?: `0x${string}`[];
      decayPercentage?: bigint;
      decayInterval?: bigint;
      address?: string;
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
      token: `0x${string}`;
    }> = [];

    const entryMethods: Array<{
      spaceId: bigint;
      joinMethod: bigint;
    }> = [];

    const tokenRequirements: Array<{
      spaceId: bigint;
      token: `0x${string}`;
      amount: bigint;
    }> = [];

    let votingMethodsToken: {
      spaceId: bigint | undefined;
      token: `0x${string}` | '';
    } = {
      spaceId: undefined,
      token: '',
    };

    let buyHyphaTokensData: {
      amount: bigint | undefined;
    } = {
      amount: undefined,
    };

    let activateSpacesData: {
      spaceIds: bigint[];
      paymentAmounts: bigint[];
      tokenSymbol: string;
    } = {
      spaceIds: [],
      paymentAmounts: [],
      tokenSymbol: '',
    };

    let delegatesData: {
      member?: string;
      space?: bigint;
    } = {
      member: undefined,
      space: undefined,
    };

    let minimumProposalDurationData: {
      spaceId?: string;
      duration?: bigint;
    } = {
      spaceId: undefined,
      duration: undefined,
    };

    let transparencySettingsData: {
      spaceDiscoverability?: number;
      spaceActivityAccess?: number;
    } = {
      spaceDiscoverability: undefined,
      spaceActivityAccess: undefined,
    };

    (transactions as any[]).forEach((tx) => {
      const decoded = decodeTransaction(tx);

      if (!decoded) return;

      switch (decoded.type) {
        case 'transfer':
          transfers.push(decoded.data);
          break;

        case 'token':
          tokens.push(decoded.data);
          break;

        case 'votingMethod':
          votingMethods.push(decoded.data);
          break;

        case 'entryMethod':
          entryMethods.push(decoded.data);
          break;

        case 'mint':
          mintings.push({ ...decoded.data, token: tx.target });
          break;

        case 'tokenRequirement':
          tokenRequirements.push(decoded.data);
          break;

        case 'votingToken':
          votingMethodsToken = decoded.data;
          break;

        case 'investInHypha':
          buyHyphaTokensData = decoded.data;
          break;

        case 'payForSpaces':
          activateSpacesData = {
            ...decoded.data,
            tokenSymbol: 'USDC',
          };
          break;

        case 'payInHypha':
          activateSpacesData = {
            ...decoded.data,
            tokenSymbol: 'HYPHA',
          };
          break;

        case 'delegate':
          delegatesData = decoded.data;
          break;

        case 'setMinimumProposalDuration':
          minimumProposalDurationData = decoded.data;
          break;

        case 'setSpaceDiscoverability':
          transparencySettingsData.spaceDiscoverability = Number(
            decoded.data.discoverability,
          );
          break;

        case 'setSpaceAccess':
          transparencySettingsData.spaceActivityAccess = Number(
            decoded.data.access,
          );
          break;

        default:
          break;
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
      votingMethodsToken,
      buyHyphaTokensData,
      activateSpacesData,
      delegatesData,
      minimumProposalDurationData,
      transparencySettingsData,
    };
  }, [data]);

  return {
    proposalDetails: parsedProposal,
    isLoading,
    error,
  };
};
