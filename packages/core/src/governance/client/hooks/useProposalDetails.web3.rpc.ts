'use client';

import { publicClient } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { getProposalDetails } from '../web3';
import React from 'react';
import { decodeFunctionData } from 'viem';
import { decayingSpaceTokenAbi } from '../../../generated';
import { decodeTransaction } from './decoders';
import { decayBasisPointsToFormPercent } from '../../voice-decay-units';
import { getEscrowImplementationAddress } from '../escrow';

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
  proposalId: number | undefined | null;
}) => {
  const hasValidProposalId =
    proposalId != null && Number.isFinite(Number(proposalId));
  const { data, isLoading, error, mutate } = useSWR(
    hasValidProposalId ? [Number(proposalId), 'proposalDetails'] : null,
    async ([proposalId]) =>
      publicClient.readContract(
        getProposalDetails({ proposalId: BigInt(proposalId) }),
      ),
    {
      revalidateOnFocus: true,
      // Only poll while the proposal is still live. Once it is executed
      // (index 3) or expired (index 4) its on-chain state is immutable, so
      // there is nothing to poll for - stop hitting the RPC every 10s.
      refreshInterval: (latest) =>
        latest && (latest[3] || latest[4]) ? 0 : 10000,
    },
  );

  // Keep the latest raw tuple in a ref so `refreshUntilVoteApplied` can compare
  // pre/post-vote tallies without being recreated on every data change.
  const dataRef = React.useRef(data);
  dataRef.current = data;

  /**
   * After a vote we want the quorum/unity bars to update immediately, but the
   * RPC node the read hits can briefly lag the just-mined vote transaction, so a
   * single refetch sometimes returns stale tallies (the bars then only correct
   * on the next 10s poll - the "sometimes not quick" behaviour). Refetch a few
   * times until the yes+no tally changes (or we run out of attempts). Each
   * refetch updates the SWR cache regardless, so the bars still reflect whatever
   * the latest read returns.
   */
  const refreshUntilVoteApplied = React.useCallback(async () => {
    const baseline = dataRef.current
      ? Number(dataRef.current[5]) + Number(dataRef.current[6])
      : null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const updated = await mutate();
      if (
        !updated ||
        baseline === null ||
        Number(updated[5]) + Number(updated[6]) !== baseline
      ) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }, [mutate]);

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
      priceCurrencyFeed?: `0x${string}`;
      useTransferWhitelist?: boolean;
      useReceiveWhitelist?: boolean;
      initialTransferWhitelist?: `0x${string}`[];
      initialReceiveWhitelist?: `0x${string}`[];
      /**
       * Web3 ids of spaces seeded into the on-chain transfer/receive whitelists
       * at deploy time (factory `initial(Transfer|Receive)WhitelistSpaceIds`
       * args). Decoded from the new factory ABI; absent on legacy proposals.
       */
      initialTransferWhitelistSpaceIds?: readonly bigint[];
      initialReceiveWhitelistSpaceIds?: readonly bigint[];
      decayPercentage?: bigint;
      decayInterval?: bigint;
      address?: string;
      /** Mutual credit — only set on `regular` tokens deployed with credit configured. */
      defaultCreditLimit?: bigint;
      initialCreditWhitelistSpaceIds?: readonly bigint[];
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

    const updateTokenData: {
      address?: `0x${string}`;
      name?: string;
      symbol?: string;
      maxSupply?: bigint;
      /** From `initialize` calldata when present; used for resubmit max supply type */
      fixedMaxSupply?: boolean;
      transferable?: boolean;
      autoMinting?: boolean;
      priceWithCurrency?: {
        tokenPrice: bigint;
        priceCurrencyFeed: string;
      };
      decayPercentage?: bigint;
      decayInterval?: bigint;
      useTransferWhitelist?: boolean;
      useReceiveWhitelist?: boolean;
      /** From `batchSetTransferWhitelist` calldata (update-token proposals) */
      initialTransferWhitelist?: `0x${string}`[];
      /** From `batchAddTransferWhitelistSpaces` (resolved to addresses in UI) */
      initialTransferWhitelistSpaceIds?: number[];
      /** From `batchSetReceiveWhitelist` calldata */
      initialReceiveWhitelist?: `0x${string}`[];
      initialReceiveWhitelistSpaceIds?: number[];
      archiveToken?: boolean;
      /** From `setDefaultCreditLimit` (raw on-chain bigint, scaled by 1e18). */
      defaultCreditLimit?: bigint;
      /** From `batchAddCreditWhitelistSpaces` calldata. */
      addCreditWhitelistSpaceIds?: number[];
      /** From `batchRemoveCreditWhitelistSpaces` calldata. */
      removeCreditWhitelistSpaceIds?: number[];
    } = {
      address: undefined,
      name: undefined,
      symbol: undefined,
      maxSupply: undefined,
      transferable: undefined,
      autoMinting: undefined,
      priceWithCurrency: undefined,
      decayPercentage: undefined,
      decayInterval: undefined,
      useTransferWhitelist: undefined,
      useReceiveWhitelist: undefined,
      initialTransferWhitelist: undefined,
      initialTransferWhitelistSpaceIds: undefined,
      initialReceiveWhitelist: undefined,
      initialReceiveWhitelistSpaceIds: undefined,
      archiveToken: undefined,
      fixedMaxSupply: undefined,
      defaultCreditLimit: undefined,
      addCreditWhitelistSpaceIds: undefined,
      removeCreditWhitelistSpaceIds: undefined,
    };

    const assignUpdateTokenAddress = (addr: `0x${string}`) => {
      const next = addr.toLowerCase() as `0x${string}`;
      if (
        updateTokenData.address &&
        updateTokenData.address.toLowerCase() !== next
      ) {
        console.warn(
          '[useProposalDetails] Inconsistent token addresses in update-token proposal transactions',
          { existing: updateTokenData.address, next: addr },
        );
      }
      updateTokenData.address = addr;
    };

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

    let exchangeEscrowData: {
      partyA?: string;
      partyB?: string;
      tokenA?: string;
      tokenB?: string;
      amountA?: bigint;
      amountB?: bigint;
      sendFundsNow?: boolean;
    } = {};

    const escrowContractAddress = getEscrowImplementationAddress();

    (transactions as ProposalTransaction[]).forEach((tx) => {
      const decoded = decodeTransaction(tx);

      if (!decoded) return;

      switch (decoded.type) {
        case 'transfer':
          transfers.push(decoded.data as (typeof transfers)[number]);
          break;

        case 'token': {
          const tokenPayload = decoded.data as (typeof tokens)[number] & {
            address?: string;
          };
          tokens.push({
            ...tokenPayload,
            address: tokenPayload.address ?? tx.target,
          });
          break;
        }

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
        case 'setTokenName': {
          const d = decoded.data as {
            address: `0x${string}`;
            name: string;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.name = d.name;
          break;
        }

        case 'setTokenSymbol': {
          const d = decoded.data as {
            address: `0x${string}`;
            symbol: string;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.symbol = d.symbol;
          break;
        }

        case 'setTokenMaxSupply': {
          const d = decoded.data as {
            address: `0x${string}`;
            maxSupply: bigint;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.maxSupply = d.maxSupply;
          break;
        }

        case 'setTokenTransferable': {
          const d = decoded.data as {
            address: `0x${string}`;
            transferable: boolean;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.transferable = d.transferable;
          break;
        }

        case 'setTokenAutoMinting': {
          const d = decoded.data as {
            address: `0x${string}`;
            autoMinting: boolean;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.autoMinting = d.autoMinting;
          break;
        }

        case 'setTokenPriceWithCurrency': {
          const d = decoded.data as {
            address: `0x${string}`;
            tokenPrice: bigint;
            priceCurrencyFeed: string;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.priceWithCurrency = {
            tokenPrice: d.tokenPrice,
            priceCurrencyFeed: d.priceCurrencyFeed,
          };
          break;
        }

        case 'setTokenDecayPercentage': {
          const d = decoded.data as {
            address: `0x${string}`;
            decayPercentage: bigint;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.decayPercentage = BigInt(
            decayBasisPointsToFormPercent(Number(d.decayPercentage)),
          );
          break;
        }

        case 'setTokenDecayInterval': {
          const d = decoded.data as {
            address: `0x${string}`;
            decayInterval: bigint;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.decayInterval = d.decayInterval;
          break;
        }

        case 'setTokenUseTransferWhitelist': {
          const d = decoded.data as {
            address: `0x${string}`;
            useTransferWhitelist: boolean;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.useTransferWhitelist = d.useTransferWhitelist;
          break;
        }

        case 'setTokenUseReceiveWhitelist': {
          const d = decoded.data as {
            address: `0x${string}`;
            useReceiveWhitelist: boolean;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.useReceiveWhitelist = d.useReceiveWhitelist;
          break;
        }

        case 'setTokenBatchTransferWhitelist': {
          const d = decoded.data as {
            address: `0x${string}`;
            accounts: `0x${string}`[];
            allowed: boolean[];
          };
          assignUpdateTokenAddress(d.address);
          const allowedAddrs = d.accounts.filter(
            (_, i) => d.allowed[i] === true,
          );
          updateTokenData.initialTransferWhitelist = [
            ...(updateTokenData.initialTransferWhitelist ?? []),
            ...allowedAddrs,
          ];
          break;
        }

        case 'setTokenBatchReceiveWhitelist': {
          const d = decoded.data as {
            address: `0x${string}`;
            accounts: `0x${string}`[];
            allowed: boolean[];
          };
          assignUpdateTokenAddress(d.address);
          const allowedAddrs = d.accounts.filter(
            (_, i) => d.allowed[i] === true,
          );
          updateTokenData.initialReceiveWhitelist = [
            ...(updateTokenData.initialReceiveWhitelist ?? []),
            ...allowedAddrs,
          ];
          break;
        }

        case 'setTokenBatchAddTransferWhitelistSpaces': {
          const d = decoded.data as {
            address: `0x${string}`;
            spaceIds: readonly bigint[];
          };
          assignUpdateTokenAddress(d.address);
          const ids = d.spaceIds.map((x) => Number(x));
          updateTokenData.initialTransferWhitelistSpaceIds = [
            ...(updateTokenData.initialTransferWhitelistSpaceIds ?? []),
            ...ids,
          ];
          break;
        }

        case 'setTokenBatchAddReceiveWhitelistSpaces': {
          const d = decoded.data as {
            address: `0x${string}`;
            spaceIds: readonly bigint[];
          };
          assignUpdateTokenAddress(d.address);
          const ids = d.spaceIds.map((x) => Number(x));
          updateTokenData.initialReceiveWhitelistSpaceIds = [
            ...(updateTokenData.initialReceiveWhitelistSpaceIds ?? []),
            ...ids,
          ];
          break;
        }

        case 'setTokenArchived': {
          const d = decoded.data as {
            address: `0x${string}`;
            archiveToken: boolean;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.archiveToken = d.archiveToken;
          break;
        }

        case 'setTokenDefaultCreditLimit': {
          const d = decoded.data as {
            address: `0x${string}`;
            defaultCreditLimit: bigint;
          };
          assignUpdateTokenAddress(d.address);
          updateTokenData.defaultCreditLimit = d.defaultCreditLimit;
          break;
        }

        case 'setTokenBatchAddCreditWhitelistSpaces': {
          const d = decoded.data as {
            address: `0x${string}`;
            spaceIds: readonly bigint[];
          };
          assignUpdateTokenAddress(d.address);
          const ids = d.spaceIds.map((x) => Number(x));
          updateTokenData.addCreditWhitelistSpaceIds = [
            ...(updateTokenData.addCreditWhitelistSpaceIds ?? []),
            ...ids,
          ];
          break;
        }

        case 'setTokenBatchRemoveCreditWhitelistSpaces': {
          const d = decoded.data as {
            address: `0x${string}`;
            spaceIds: readonly bigint[];
          };
          assignUpdateTokenAddress(d.address);
          const ids = d.spaceIds.map((x) => Number(x));
          updateTokenData.removeCreditWhitelistSpaceIds = [
            ...(updateTokenData.removeCreditWhitelistSpaceIds ?? []),
            ...ids,
          ];
          break;
        }

        case 'redeemTokens': {
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
        }

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

        case 'exchangeEscrow': {
          const d = decoded.data as {
            partyA?: string;
            partyB: string;
            tokenA: string;
            tokenB: string;
            amountA: bigint;
            amountB: bigint;
            sendFundsNow: boolean;
          };
          exchangeEscrowData = {
            ...(d.partyA ? { partyA: d.partyA } : {}),
            partyB: d.partyB,
            tokenA: d.tokenA,
            tokenB: d.tokenB,
            amountA: d.amountA,
            amountB: d.amountB,
            sendFundsNow: d.sendFundsNow,
          };
          break;
        }

        default:
          break;
      }
    });

    if (
      updateTokenData.address &&
      transactions &&
      Array.isArray(transactions)
    ) {
      for (const tx of transactions as ProposalTransaction[]) {
        try {
          const decoded = decodeFunctionData({
            abi: decayingSpaceTokenAbi,
            data: tx.data as `0x${string}`,
          });
          if (
            decoded.functionName === 'initialize' &&
            typeof tx.target === 'string' &&
            tx.target.toLowerCase() === updateTokenData.address.toLowerCase()
          ) {
            const args = decoded.args as readonly unknown[];
            const fixed = args[6] as boolean | undefined;
            if (typeof fixed === 'boolean') {
              updateTokenData.fixedMaxSupply = fixed;
            }
            break;
          }
        } catch {
          // not a DecayingSpaceToken call
        }
      }
    }

    if (
      escrowContractAddress &&
      exchangeEscrowData.tokenA &&
      exchangeEscrowData.amountA !== undefined
    ) {
      transfers.push({
        recipient: escrowContractAddress,
        rawAmount: exchangeEscrowData.amountA,
        token: exchangeEscrowData.tokenA,
        value: 0n,
      });
    }

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
      updateTokenData,
      redeemTokensData,
      spaceTokenPurchaseData,
      exchangeEscrowData,
    };
  }, [data]);

  return {
    proposalDetails: parsedProposal,
    isLoading,
    error,
    mutate,
    refreshUntilVoteApplied,
  };
};
