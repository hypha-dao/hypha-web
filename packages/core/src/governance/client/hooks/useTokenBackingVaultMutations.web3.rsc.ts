'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import {
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
} from 'viem';

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
import { getGovernanceChainId } from './governance-chain-id';
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

const tokenPriceAbi = [
  {
    inputs: [],
    name: 'tokenPrice',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function readTokenPrice(address: `0x${string}`): Promise<bigint | null> {
  try {
    return (await publicClient.readContract({
      address,
      abi: tokenPriceAbi,
      functionName: 'tokenPrice',
    })) as bigint;
  } catch {
    return null;
  }
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

const chainId = getGovernanceChainId();
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
      const validAddCollaterals =
        arg.addCollaterals?.filter(
          (c) => c.token && Number.parseFloat(c.amount) > 0,
        ) ?? [];
      const validRemoveCollaterals =
        arg.removeCollaterals?.filter(
          (c) => c.token && Number.parseFloat(c.amount) > 0,
        ) ?? [];
      const willAddBacking =
        arg.activateVault && validAddCollaterals.length > 0;
      const vaultExists = await publicClient.readContract({
        address: vaultAddress,
        abi: tokenBackingVaultImplementationAbi,
        functionName: 'vaultExists',
        args: [spaceId, spaceToken],
      });
      const currentVaultConfig = vaultExists
        ? await publicClient.readContract({
            address: vaultAddress,
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'getVaultConfig',
            args: [spaceId, spaceToken],
          })
        : null;
      const currentRedeemEnabled = currentVaultConfig
        ? currentVaultConfig.redeemEnabled
        : false;

      // True when this proposal will create a brand new vault via addBackingToken.
      // _getOrCreateVault sets minimumBackingBps, redemptionPrice/currencyFeed,
      // maxRedemptionBps and maxRedemptionPeriodDays during creation, so the
      // separate set* calls below would be redundant in that case.
      const isCreatingNewVault = !vaultExists && willAddBacking;

      // ============================================================
      //  Preflight validation — surfaces the contract-level reverts
      //  with actionable messages BEFORE the user signs / votes.
      //  Mirrors the require() checks in TokenBackingVaultImplementation
      //  so failures don't end up as opaque "Execution failed" reverts
      //  from the executor (it drops returndata).
      // ============================================================
      const validationErrors: string[] = [];

      // Contract requires at least one backing token to create a vault.
      if (
        arg.activateVault &&
        !vaultExists &&
        validAddCollaterals.length === 0
      ) {
        validationErrors.push(
          'At least one backing collateral is required to create a vault.',
        );
      }

      // Space token must have tokenPrice() > 0 when creating a new vault.
      if (isCreatingNewVault) {
        const spaceTokenPrice = await readTokenPrice(spaceToken);
        if (spaceTokenPrice === null) {
          validationErrors.push(
            'The selected space token does not expose tokenPrice(). Pick a Hypha-issued space token.',
          );
        } else if (spaceTokenPrice === 0n) {
          validationErrors.push(
            'The selected space token has no price set. Update the token to set a price greater than 0 before creating a backing vault.',
          );
        }
      }

      // Backing tokens without a Chainlink feed mapping must expose
      // tokenPrice() > 0 (the contract reads it directly).
      if (validAddCollaterals.length > 0) {
        for (const c of validAddCollaterals) {
          const hasFeed = Boolean(
            ASSET_PRICE_FEED_BY_TOKEN[c.token.toLowerCase()],
          );
          if (hasFeed) continue;
          const price = await readTokenPrice(c.token as `0x${string}`);
          if (price === null) {
            validationErrors.push(
              `Backing token ${c.token} has no Chainlink price feed mapping and does not expose tokenPrice(). Pick a supported token (e.g. USDC, WETH, cbBTC, EURC) or a Hypha-issued token with a price set.`,
            );
          } else if (price === 0n) {
            validationErrors.push(
              `Backing token ${c.token} has no price set. Set a tokenPrice greater than 0 on the token, or pick a token with a Chainlink price feed.`,
            );
          }
        }
      }

      // Maximum-redemption cap requires a non-zero rolling period
      // (matches `Period must be > 0 when cap is set` in the contract).
      if (
        (arg.maxRedemptionPercent ?? 0) > 0 &&
        (arg.maxRedemptionPeriodDays ?? 0) <= 0
      ) {
        validationErrors.push(
          'Maximum Redemption % is set, but the rolling period (days) is missing. Pick a period or set Maximum Redemption % to 0.',
        );
      }

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      // Approve Vault contract to spend tokens on behalf of the Space.
      // Must be the first transactions executed so addBackingToken can transfer tokens.
      if (validAddCollaterals.length) {
        const uniqueTokens = new Map<string, `0x${string}`>();
        for (const c of validAddCollaterals) {
          const key = c.token.toLowerCase();
          if (!uniqueTokens.has(key)) {
            uniqueTokens.set(key, c.token as `0x${string}`);
          }
        }
        for (const token of uniqueTokens.values()) {
          transactions.push({
            target: token,
            value: 0n,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [vaultAddress as `0x${string}`, maxUint256],
            }),
          });
        }
      }

      if (willAddBacking && validAddCollaterals.length) {
        let existingBackingTokens = new Set<string>();
        if (vaultExists) {
          const configuredBackingTokens = await publicClient.readContract({
            address: vaultAddress,
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'getBackingTokens',
            args: [spaceId, spaceToken],
          });
          existingBackingTokens = new Set(
            configuredBackingTokens.map((token) => token.toLowerCase()),
          );
        }

        const collateralsForAddBacking = validAddCollaterals.filter((c) =>
          existingBackingTokens.has(c.token.toLowerCase()),
        );
        const collateralsForAddBackingToken = validAddCollaterals.filter(
          (c) => !existingBackingTokens.has(c.token.toLowerCase()),
        );

        if (collateralsForAddBacking.length > 0) {
          const backingTokens = collateralsForAddBacking.map(
            (c) => c.token as `0x${string}`,
          );
          const amounts: bigint[] = [];
          for (const c of collateralsForAddBacking) {
            const decimals = await getTokenDecimals(c.token);
            amounts.push(parseUnits(c.amount, decimals));
          }
          transactions.push({
            target: vaultAddress,
            value: 0n,
            data: encodeFunctionData({
              abi: tokenBackingVaultImplementationAbi,
              functionName: 'addBacking',
              args: [spaceId, spaceToken, backingTokens, amounts],
            }),
          });
        }

        if (collateralsForAddBackingToken.length > 0) {
          const backingTokens = collateralsForAddBackingToken.map(
            (c) => c.token as `0x${string}`,
          );
          const priceFeeds = collateralsForAddBackingToken.map(
            (c) =>
              ASSET_PRICE_FEED_BY_TOKEN[c.token.toLowerCase()] ??
              (HYPH_TOKEN_PRICE_FEED as `0x${string}`),
          );
          const tokenDecimals: number[] = [];
          const fundingAmounts: bigint[] = [];

          for (const c of collateralsForAddBackingToken) {
            const decimals = await getTokenDecimals(c.token);
            tokenDecimals.push(decimals);
            fundingAmounts.push(parseUnits(c.amount, decimals));
          }

          const minimumBackingBps = BigInt(
            (arg.minimumBackingPercent ?? 0) * 100,
          );
          const redemptionPrice = arg.tokenPrice
            ? BigInt(
                Math.round(
                  parseFloat(arg.tokenPrice) * Number(PRICE_PRECISION),
                ),
              )
            : 0n;
          const currencyFeed =
            (arg.referenceCurrency as `0x${string}`) ??
            (CURRENCY_FEEDS.USD as `0x${string}`);
          const maxRedemptionBps = BigInt(
            (arg.maxRedemptionPercent ?? 0) * 100,
          );
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
      }

      if (
        (willAddBacking || vaultExists) &&
        (!vaultExists || currentRedeemEnabled !== arg.enableRedemption)
      ) {
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'setRedeemEnabled',
            args: [spaceId, spaceToken, arg.enableRedemption],
          }),
        });
      }

      if (arg.redemptionStartDate && (willAddBacking || vaultExists)) {
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

      // The next three calls are redundant when creating a new vault —
      // addBackingToken already passes the same values into _getOrCreateVault.
      // Only emit them when updating an existing vault.
      if (!isCreatingNewVault && arg.tokenPrice && arg.referenceCurrency) {
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
        !isCreatingNewVault &&
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

      if (!isCreatingNewVault && (arg.minimumBackingPercent ?? 0) > 0) {
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

      if (validRemoveCollaterals.length) {
        for (const c of validRemoveCollaterals) {
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
