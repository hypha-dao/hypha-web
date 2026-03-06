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

    let membershipExitData: {
      member?: string;
      space?: bigint;
    } = {
      member: undefined,
      space: undefined,
    };

    let transparencySettingsData: {
      spaceDiscoverability?: number;
      spaceActivityAccess?: number;
    } = {
      spaceDiscoverability: undefined,
      spaceActivityAccess: undefined,
    };

    let tokenBackingVaultData: {
      spaceToken?: string;
      addCollaterals?: Array<{
        token: string;
        amount: string;
        decimals: number;
      }>;
      removeCollaterals?: Array<{ token: string; amount: string }>;
      enableRedemption?: boolean;
      redemptionStartDate?: Date;
      redemptionPrice?: string;
      currencyFeed?: string;
      maxRedemptionPercent?: number;
      maxRedemptionPeriodDays?: number;
      minimumBackingPercent?: number;
      whitelistEnabled?: boolean;
      whitelistedAddresses?: string[];
    } = {};

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

        case 'membershipExit':
          membershipExitData = decoded.data;
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

        case 'tokenBackingVault': {
          const d = decoded.data as Record<string, unknown>;
          if (d.spaceToken) {
            tokenBackingVaultData.spaceToken = d.spaceToken as string;
          }
          switch (d.action) {
            case 'addBackingToken': {
              const backingTokens = d.backingTokens as `0x${string}`[];
              const fundingAmounts = d.fundingAmounts as bigint[];
              const tokenDecimals = d.tokenDecimals as number[];
              tokenBackingVaultData.addCollaterals = backingTokens.map(
                (token, i) => ({
                  token,
                  amount: (
                    Number(fundingAmounts[i]) /
                    10 ** (tokenDecimals[i] ?? 18)
                  ).toString(),
                  decimals: tokenDecimals[i] ?? 18,
                }),
              );
              tokenBackingVaultData.minimumBackingPercent =
                Number(d.minimumBackingBps) / 100;
              tokenBackingVaultData.redemptionPrice =
                Number(d.redemptionPrice) > 0
                  ? (Number(d.redemptionPrice) / 1_000_000).toFixed(6)
                  : undefined;
              tokenBackingVaultData.currencyFeed =
                d.redemptionPriceCurrencyFeed as string;
              tokenBackingVaultData.maxRedemptionPercent =
                Number(d.maxRedemptionBps) / 100;
              tokenBackingVaultData.maxRedemptionPeriodDays = Number(
                d.maxRedemptionPeriodDays,
              );
              break;
            }
            case 'setRedeemEnabled':
              tokenBackingVaultData.enableRedemption = d.enabled as boolean;
              break;
            case 'setRedemptionStartDate':
              tokenBackingVaultData.redemptionStartDate = new Date(
                Number(d.startDate) * 1000,
              );
              break;
            case 'setRedemptionPrice':
              tokenBackingVaultData.redemptionPrice =
                Number(d.price) > 0
                  ? (Number(d.price) / 1_000_000).toFixed(6)
                  : undefined;
              tokenBackingVaultData.currencyFeed = d.currencyFeed as string;
              break;
            case 'setMaxRedemptionPercentage':
              tokenBackingVaultData.maxRedemptionPercent =
                Number(d.maxRedemptionBps) / 100;
              tokenBackingVaultData.maxRedemptionPeriodDays = Number(
                d.periodDays,
              );
              break;
            case 'setMinimumBacking':
              tokenBackingVaultData.minimumBackingPercent =
                Number(d.minimumBackingBps) / 100;
              break;
            case 'withdrawBacking': {
              const addr = (d.backingToken as string)?.toLowerCase();
              const decimals =
                addr === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' ||
                addr === '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'
                  ? 6
                  : addr === '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'
                  ? 8
                  : 18;
              const entry = {
                token: d.backingToken as string,
                amount: (Number(d.amount) / 10 ** decimals).toString(),
              };
              tokenBackingVaultData.removeCollaterals = [
                ...(tokenBackingVaultData.removeCollaterals ?? []),
                entry,
              ];
              break;
            }
            case 'setWhitelistEnabled':
              tokenBackingVaultData.whitelistEnabled = d.enabled as boolean;
              break;
            case 'addToWhitelist':
              tokenBackingVaultData.whitelistedAddresses = [
                ...(tokenBackingVaultData.whitelistedAddresses ?? []),
                ...((d.accounts as `0x${string}`[]) ?? []),
              ];
              break;
            default:
              break;
          }
          break;
        }

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
      membershipExitData,
      transparencySettingsData,
      tokenBackingVaultData,
    };
  }, [data]);

  return {
    proposalDetails: parsedProposal,
    isLoading,
    error,
  };
};
