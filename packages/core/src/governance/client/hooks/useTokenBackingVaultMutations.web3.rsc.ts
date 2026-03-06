'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  tokenBackingVaultImplementationAbi,
  tokenBackingVaultImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getSpaceMinProposalDuration,
  publicClient,
  useSpaceBySlug,
  getTokenDecimals,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';
import {
  ASSET_PRICE_FEED_BY_TOKEN,
  HYPH_TOKEN_PRICE_FEED,
  CURRENCY_FEEDS,
} from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';

interface BackingCollateralEntry {
  token: string;
  amount: string;
}

interface TokenBackingVaultInput {
  spaceId: number;
  spaceToken: `0x${string}`;
  activateVault: boolean;
  enableRedemption: boolean;
  addCollaterals?: BackingCollateralEntry[];
  removeCollaterals?: BackingCollateralEntry[];
  referenceCurrency?: string;
  tokenPrice?: string;
  minimumBackingPercent?: number;
  maxRedemptionPercent?: number;
  maxRedemptionPeriodDays?: number;
  redemptionStartDate?: Date | null;
  enableAdvancedRedemptionControls?: boolean;
  redemptionWhitelist?: Array<{
    type: 'member' | 'space';
    address: string;
    includeSpaceMembers?: boolean;
  }>;
}

const chainId = 8453;
const PRICE_PRECISION = 1_000_000n;

function parseUnits(value: string, decimals: number): bigint {
  const [whole, frac = ''] = value.split('.');
  const padded = whole + frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(padded || '0');
}

export const useTokenBackingVaultMutationsWeb3Rsc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();
  const { id: spaceSlug } = useParams();
  const { space } = useSpaceBySlug(spaceSlug as string);

  const {
    trigger: createTokenBackingVaultProposal,
    reset: resetCreateTokenBackingVaultMutation,
    isMutating: isCreatingTokenBackingVault,
    data: tokenBackingVaultHash,
    error: errorCreateTokenBackingVault,
  } = useSWRMutation(
    `tokenBackingVault-${proposalSlug}`,
    async (_, { arg }: { arg: TokenBackingVaultInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const vaultAddress =
        tokenBackingVaultImplementationAddress[
          chainId as keyof typeof tokenBackingVaultImplementationAddress
        ];

      const transactions: {
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }[] = [];
      const spaceId = BigInt(arg.spaceId);
      const spaceToken = arg.spaceToken;

      if (
        arg.activateVault &&
        arg.enableRedemption &&
        arg.addCollaterals?.length
      ) {
        const backingTokens = arg.addCollaterals.map(
          (c) => c.token as `0x${string}`,
        );
        const priceFeeds = arg.addCollaterals.map(
          (c) =>
            ASSET_PRICE_FEED_BY_TOKEN[c.token.toLowerCase()] ??
            (HYPH_TOKEN_PRICE_FEED as `0x${string}`),
        );
        const tokenDecimals: number[] = [];
        const fundingAmounts: bigint[] = [];

        for (const c of arg.addCollaterals) {
          const decimals = await getTokenDecimals(c.token);
          tokenDecimals.push(decimals);
          fundingAmounts.push(parseUnits(c.amount, decimals));
        }

        const minimumBackingBps = BigInt(
          (arg.minimumBackingPercent ?? 0) * 100,
        );
        const redemptionPrice = arg.tokenPrice
          ? BigInt(
              Math.round(parseFloat(arg.tokenPrice) * Number(PRICE_PRECISION)),
            )
          : 0n;
        const currencyFeed =
          (arg.referenceCurrency as `0x${string}`) ??
          (CURRENCY_FEEDS.USD as `0x${string}`);
        const maxRedemptionBps = BigInt((arg.maxRedemptionPercent ?? 0) * 100);
        const maxRedemptionPeriodDays = BigInt(
          arg.maxRedemptionPeriodDays ?? 0,
        );

        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'addBackingToken',
            args: [
              spaceId,
              spaceToken,
              backingTokens,
              priceFeeds,
              tokenDecimals,
              fundingAmounts,
              minimumBackingBps,
              redemptionPrice,
              currencyFeed,
              maxRedemptionBps,
              maxRedemptionPeriodDays,
            ],
          }),
        });
      }

      transactions.push({
        target: vaultAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: tokenBackingVaultImplementationAbi,
          functionName: 'setRedeemEnabled',
          args: [spaceId, spaceToken, arg.enableRedemption],
        }),
      });

      if (arg.redemptionStartDate) {
        const startDate = BigInt(
          Math.floor(arg.redemptionStartDate.getTime() / 1000),
        );
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'setRedemptionStartDate',
            args: [spaceId, spaceToken, startDate],
          }),
        });
      }

      if (
        arg.tokenPrice &&
        arg.referenceCurrency &&
        !arg.addCollaterals?.length
      ) {
        const redemptionPrice = BigInt(
          Math.round(parseFloat(arg.tokenPrice) * Number(PRICE_PRECISION)),
        );
        const currencyFeed = arg.referenceCurrency as `0x${string}`;
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'setRedemptionPrice',
            args: [spaceId, spaceToken, redemptionPrice, currencyFeed],
          }),
        });
      }

      if (
        (arg.maxRedemptionPercent ?? 0) > 0 &&
        (arg.maxRedemptionPeriodDays ?? 0) > 0
      ) {
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'setMaxRedemptionPercentage',
            args: [
              spaceId,
              spaceToken,
              BigInt((arg.maxRedemptionPercent ?? 0) * 100),
              BigInt(arg.maxRedemptionPeriodDays ?? 0),
            ],
          }),
        });
      }

      if ((arg.minimumBackingPercent ?? 0) > 0) {
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'setMinimumBacking',
            args: [
              spaceId,
              spaceToken,
              BigInt((arg.minimumBackingPercent ?? 0) * 100),
            ],
          }),
        });
      }

      if (arg.removeCollaterals?.length) {
        for (const c of arg.removeCollaterals) {
          const decimals = await getTokenDecimals(c.token);
          const amount = parseUnits(c.amount, decimals);
          transactions.push({
            target: vaultAddress,
            value: 0n,
            data: encodeFunctionData({
              abi: tokenBackingVaultImplementationAbi,
              functionName: 'withdrawBacking',
              args: [spaceId, spaceToken, c.token as `0x${string}`, amount],
            }),
          });
        }
      }

      if (
        arg.enableAdvancedRedemptionControls &&
        arg.redemptionWhitelist?.length
      ) {
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'setWhitelistEnabled',
            args: [spaceId, spaceToken, true],
          }),
        });

        const memberAddresses = arg.redemptionWhitelist
          .filter((e) => e.type === 'member')
          .map((e) => e.address as `0x${string}`);
        if (memberAddresses.length) {
          transactions.push({
            target: vaultAddress,
            value: 0n,
            data: encodeFunctionData({
              abi: tokenBackingVaultImplementationAbi,
              functionName: 'addToWhitelist',
              args: [spaceId, spaceToken, memberAddresses],
            }),
          });
        }

        // addWhitelistedSpaces requires space IDs - pass spaces with web3SpaceId to resolve
        // TODO: add spaces param to input and map address -> web3SpaceId
      }

      if (transactions.length === 0) {
        throw new Error(
          'No transactions to submit. Add at least one collateral or configuration change.',
        );
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId }),
      );

      const proposalParams = {
        spaceId,
        duration: duration && duration > 0 ? duration : getDuration(7),
        transactions,
      };

      const txHash = await client.writeContract({
        address: daoProposalsImplementationAddress[chainId],
        abi: daoProposalsImplementationAbi,
        functionName: 'createProposal',
        args: [proposalParams],
      });

      return txHash;
    },
  );

  const {
    data: createdTokenBackingVault,
    isLoading: isLoadingTokenBackingVaultFromTransaction,
    error: errorWaitTokenBackingVaultFromTransaction,
  } = useSWR(
    tokenBackingVaultHash
      ? [tokenBackingVaultHash, 'waitForTokenBackingVault']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createTokenBackingVaultProposal,
    resetCreateTokenBackingVaultMutation,
    isCreatingTokenBackingVault,
    tokenBackingVaultHash,
    errorCreateTokenBackingVault,
    isLoadingTokenBackingVaultFromTransaction,
    errorWaitTokenBackingVaultFromTransaction,
    createdTokenBackingVault,
  };
};
