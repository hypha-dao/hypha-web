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

async function readTokenSymbol(address: `0x${string}`): Promise<string | null> {
  try {
    return (await publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: 'symbol',
    })) as string;
  } catch {
    return null;
  }
}

function tokenLabel(symbol: string | null): string {
  return symbol ? `"${symbol}"` : 'one of the selected tokens';
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

      // The contract accepts an empty-vault setup via the new createVault()
      // entry point. Use it when the user wants to spin up a vault now and
      // register backing collateral later.
      const willCreateEmptyVault =
        arg.activateVault && !vaultExists && validAddCollaterals.length === 0;

      // True when this proposal will create a brand new vault.
      // _getOrCreateVault initializes minimumBackingBps, redemptionPrice/currencyFeed,
      // maxRedemptionBps and maxRedemptionPeriodDays at creation, so the
      // separate set* calls below would be redundant in that case.
      const isCreatingNewVault =
        !vaultExists && (willAddBacking || willCreateEmptyVault);

      // Hoist the contract-shaped values that need to be visible both to
      // the preflight (to decide whether tokenPrice() is mandatory) and
      // the transaction-building block.
      const redemptionPrice = arg.tokenPrice
        ? BigInt(
            Math.round(parseFloat(arg.tokenPrice) * Number(PRICE_PRECISION)),
          )
        : 0n;
      const currencyFeed =
        (arg.referenceCurrency as `0x${string}`) ??
        (CURRENCY_FEEDS.USD as `0x${string}`);
      const minimumBackingBps = BigInt((arg.minimumBackingPercent ?? 0) * 100);
      const maxRedemptionBps = BigInt((arg.maxRedemptionPercent ?? 0) * 100);
      const maxRedemptionPeriodDays = BigInt(arg.maxRedemptionPeriodDays ?? 0);

      // Read the vault's existing backing tokens once and reuse the resulting
      // Set for both the preflight (to skip already-configured tokens — those
      // get added via `addBacking`, which doesn't re-validate token price) and
      // the transaction-building block below. Empty when the vault doesn't
      // exist yet, so no RPC call is needed in that case.
      let existingBackingTokens = new Set<string>();
      if (vaultExists && validAddCollaterals.length > 0) {
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

      // Only tokens passed to `addBackingToken` go through the contract's
      // price validation (see TokenBackingVaultImplementation). Tokens added
      // via `addBacking` already passed validation when first registered.
      const collateralsBeingRegistered = validAddCollaterals.filter(
        (c) => !existingBackingTokens.has(c.token.toLowerCase()),
      );

      // ============================================================
      //  Preflight validation — surfaces the contract-level reverts
      //  with actionable messages BEFORE the user signs / votes.
      //  Mirrors the require() checks in TokenBackingVaultImplementation
      //  so failures don't end up as opaque "Execution failed" reverts
      //  from the executor (it drops returndata).
      // ============================================================
      const validationErrors: string[] = [];
      const SUPPORTED_TOKENS_HINT = 'USDC, WETH, cbBTC, or EURC';

      // Space token must have tokenPrice() > 0 when creating a new vault,
      // UNLESS a redemption-price override is being set in this proposal.
      // The contract's _requirePriceableSpaceToken accepts either source.
      if (isCreatingNewVault && redemptionPrice === 0n) {
        const [spaceTokenSymbol, spaceTokenPrice] = await Promise.all([
          readTokenSymbol(spaceToken),
          readTokenPrice(spaceToken),
        ]);
        const label = tokenLabel(spaceTokenSymbol);
        if (spaceTokenPrice === null) {
          validationErrors.push(
            `We couldn't read a price from the space token ${label}. Either set a price on it or set a redemption price below, then try again.`,
          );
        } else if (spaceTokenPrice === 0n) {
          validationErrors.push(
            `The space token ${label} doesn't have a price yet. Either set its price, or set a redemption price below to use that instead.`,
          );
        }
      }

      // Backing tokens without a Chainlink feed mapping must expose
      // tokenPrice() > 0 (the contract reads it directly inside
      // addBackingToken). Skip tokens already configured on the vault —
      // those go through addBacking and won't re-trigger price validation.
      if (collateralsBeingRegistered.length > 0) {
        await Promise.all(
          collateralsBeingRegistered.map(async (c) => {
            const hasFeed = Boolean(
              ASSET_PRICE_FEED_BY_TOKEN[c.token.toLowerCase()],
            );
            if (hasFeed) return;
            const tokenAddr = c.token as `0x${string}`;
            const [symbol, price] = await Promise.all([
              readTokenSymbol(tokenAddr),
              readTokenPrice(tokenAddr),
            ]);
            const label = tokenLabel(symbol);
            if (price === null) {
              validationErrors.push(
                `We can't find a price source for the backing token ${label}. Pick a supported token (${SUPPORTED_TOKENS_HINT}) or a token issued by your space that already has a price set.`,
              );
            } else if (price === 0n) {
              validationErrors.push(
                `The backing token ${label} doesn't have a price yet. Set its price first, or pick a supported token (${SUPPORTED_TOKENS_HINT}) instead.`,
              );
            }
          }),
        );
      }

      // Maximum-redemption cap requires a non-zero rolling period
      // (matches `Period must be > 0 when cap is set` in the contract).
      if (
        (arg.maxRedemptionPercent ?? 0) > 0 &&
        (arg.maxRedemptionPeriodDays ?? 0) <= 0
      ) {
        validationErrors.push(
          'Please choose a redemption period to go with the maximum redemption percentage, or set the percentage to 0 to remove the limit.',
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

      if (willCreateEmptyVault) {
        // No backing tokens to register — call the dedicated createVault()
        // entry point to spin up the empty vault with its config.
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'createVault',
            args: [
              spaceId,
              spaceToken,
              minimumBackingBps,
              redemptionPrice,
              currencyFeed,
              maxRedemptionBps,
              maxRedemptionPeriodDays,
            ],
          }),
        });
      }

      if (willAddBacking && validAddCollaterals.length) {
        // Reuses `existingBackingTokens` populated above so the same
        // membership decision drives both preflight validation and the
        // addBacking-vs-addBackingToken split below.
        const collateralsForAddBacking = validAddCollaterals.filter((c) =>
          existingBackingTokens.has(c.token.toLowerCase()),
        );
        const collateralsForAddBackingToken = collateralsBeingRegistered;

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
        (willAddBacking || willCreateEmptyVault || vaultExists) &&
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

      if (
        arg.redemptionStartDate &&
        (willAddBacking || willCreateEmptyVault || vaultExists)
      ) {
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
      // addBackingToken / createVault already pass the same values into
      // _getOrCreateVault. Only emit them when updating an existing vault.
      if (!isCreatingNewVault && arg.tokenPrice && arg.referenceCurrency) {
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
        maxRedemptionBps > 0n &&
        maxRedemptionPeriodDays > 0n
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
              maxRedemptionBps,
              maxRedemptionPeriodDays,
            ],
          }),
        });
      }

      if (!isCreatingNewVault && minimumBackingBps > 0n) {
        transactions.push({
          target: vaultAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'setMinimumBacking',
            args: [spaceId, spaceToken, minimumBackingBps],
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
