'use client';

import { publicClient } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { getProposalDetails } from '../web3';
import React from 'react';
import { decodeTransaction } from './decoders';

const formatRedemptionPrice = (rawPrice: unknown) => {
  const numeric = Number(rawPrice);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return (numeric / 1_000_000).toString();
};

const resolveTokenDecimals = (address: string) => {
  const normalized = address.toLowerCase();
  if (
    normalized === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' ||
    normalized === '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'
  ) {
    return 6;
  }
  if (normalized === '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf') {
    return 8;
  }
  return 18;
};

type ProposalTransaction = Parameters<typeof decodeTransaction>[0];

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

    const burnings: Array<{
      member: `0x${string}` | null;
      number: bigint;
      token: `0x${string}`;
      allBalance?: boolean;
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

    const transparencySettingsData: {
      spaceDiscoverability?: number;
      spaceActivityAccess?: number;
    } = {
      spaceDiscoverability: undefined,
      spaceActivityAccess: undefined,
    };

    const tokenBackingVaultData: {
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

    const redeemTokensData: {
      token?: `0x${string}`;
      amount?: bigint;
      web3SpaceId?: bigint;
      conversions: {
        asset: `0x${string}`;
        percentage: bigint;
      }[];
    } = {
      token: undefined,
      amount: undefined,
      web3SpaceId: undefined,
      conversions: [],
    };

    let spaceTokenPurchaseData: {
      tokenAddress?: string;
      paymentToken?: string;
      paymentTokenPricePerToken?: bigint;
      tokensForSale?: bigint;
      isActive?: boolean;
    } = {};

    (transactions as ProposalTransaction[]).forEach((tx) => {
      const decoded = decodeTransaction(tx);

      if (!decoded) return;

      switch (decoded.type) {
        case 'transfer':
          transfers.push(decoded.data as (typeof transfers)[number]);
          break;

        case 'token':
          tokens.push(decoded.data as (typeof tokens)[number]);
          break;

        case 'votingMethod':
          votingMethods.push(decoded.data as (typeof votingMethods)[number]);
          break;

        case 'entryMethod':
          entryMethods.push(decoded.data as (typeof entryMethods)[number]);
          break;

        case 'mint': {
          const mintData = decoded.data as Omit<
            (typeof mintings)[number],
            'token'
          >;
          mintings.push({ ...mintData, token: tx.target });
          break;
        }

        case 'burn': {
          const burnData = decoded.data as Omit<
            (typeof burnings)[number],
            'token' | 'allBalance'
          >;
          const normalizedMember =
            burnData.member &&
            burnData.member.toLowerCase() ===
              '0x0000000000000000000000000000000000000000'
              ? null
              : burnData.member;
          burnings.push({
            ...burnData,
            member: normalizedMember,
            token: tx.target,
            allBalance: false,
          });
          break;
        }

        case 'tokenRequirement':
          tokenRequirements.push(
            decoded.data as (typeof tokenRequirements)[number],
          );
          break;

        case 'votingToken':
          votingMethodsToken = decoded.data as typeof votingMethodsToken;
          break;

        case 'investInHypha':
          buyHyphaTokensData = decoded.data as typeof buyHyphaTokensData;
          break;

        case 'payForSpaces': {
          const payForSpacesData = decoded.data as Omit<
            typeof activateSpacesData,
            'tokenSymbol'
          >;
          activateSpacesData = {
            ...payForSpacesData,
            tokenSymbol: 'USDC',
          };
          break;
        }

        case 'payInHypha': {
          const payInHyphaData = decoded.data as Omit<
            typeof activateSpacesData,
            'tokenSymbol'
          >;
          activateSpacesData = {
            ...payInHyphaData,
            tokenSymbol: 'HYPHA',
          };
          break;
        }

        case 'delegate':
          delegatesData = decoded.data as typeof delegatesData;
          break;

        case 'setMinimumProposalDuration':
          minimumProposalDurationData =
            decoded.data as typeof minimumProposalDurationData;
          break;

        case 'membershipExit':
          membershipExitData = decoded.data as typeof membershipExitData;
          break;

        case 'setSpaceDiscoverability': {
          const transparencyData = decoded.data as {
            discoverability?: unknown;
          };
          transparencySettingsData.spaceDiscoverability = Number(
            transparencyData.discoverability,
          );
          break;
        }

        case 'setSpaceAccess': {
          const transparencyData = decoded.data as { access?: unknown };
          transparencySettingsData.spaceActivityAccess = Number(
            transparencyData.access,
          );
          break;
        }

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
              const nextCollaterals = backingTokens.map((token, i) => ({
                token,
                amount: (
                  Number(fundingAmounts[i]) /
                  10 ** (tokenDecimals[i] ?? 18)
                ).toString(),
                decimals: tokenDecimals[i] ?? 18,
              }));
              tokenBackingVaultData.addCollaterals = [
                ...(tokenBackingVaultData.addCollaterals ?? []),
                ...nextCollaterals,
              ];
              tokenBackingVaultData.minimumBackingPercent =
                Number(d.minimumBackingBps) / 100;
              tokenBackingVaultData.redemptionPrice = formatRedemptionPrice(
                d.redemptionPrice,
              );
              tokenBackingVaultData.currencyFeed =
                d.redemptionPriceCurrencyFeed as string;
              tokenBackingVaultData.maxRedemptionPercent =
                Number(d.maxRedemptionBps) / 100;
              tokenBackingVaultData.maxRedemptionPeriodDays = Number(
                d.maxRedemptionPeriodDays,
              );
              break;
            }
            case 'addBacking': {
              const backingTokens = d.backingTokens as `0x${string}`[];
              const fundingAmounts = d.fundingAmounts as bigint[];
              const nextCollaterals = backingTokens.map((token, i) => {
                const decimals = resolveTokenDecimals(token);
                return {
                  token,
                  amount: (
                    Number(fundingAmounts[i]) /
                    10 ** decimals
                  ).toString(),
                  decimals,
                };
              });
              tokenBackingVaultData.addCollaterals = [
                ...(tokenBackingVaultData.addCollaterals ?? []),
                ...nextCollaterals,
              ];
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
              tokenBackingVaultData.redemptionPrice = formatRedemptionPrice(
                d.price,
              );
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
              const decimals = resolveTokenDecimals(addr);
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

        case 'redeemTokens':
          redeemTokensData.amount = decoded.data.amount as bigint;
          redeemTokensData.token = decoded.data.token as `0x${string}`;
          redeemTokensData.web3SpaceId = decoded.data.web3SpaceId as bigint;
          const backingTokens = decoded.data.backingTokens as `0x${string}`[];
          const proportions = decoded.data.proportions as bigint[];
          const len = Math.min(backingTokens.length, proportions.length);
          for (let i = 0; i < len; i++) {
            const asset = backingTokens[i]!;
            const percentage = proportions[i]!;
            redeemTokensData.conversions.push({ asset, percentage });
          }
          break;

        case 'spaceTokenPurchase': {
          const payload = decoded.data as {
            paymentToken: string;
            paymentTokenPricePerToken: bigint;
            tokensForSale: bigint;
          };
          spaceTokenPurchaseData = {
            ...payload,
            tokenAddress: tx.target,
            isActive:
              payload.paymentToken !==
              '0x0000000000000000000000000000000000000000',
          };
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
      burnings,
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
      redeemTokensData,
      spaceTokenPurchaseData,
    };
  }, [data]);

  return {
    proposalDetails: parsedProposal,
    isLoading,
    error,
  };
};
