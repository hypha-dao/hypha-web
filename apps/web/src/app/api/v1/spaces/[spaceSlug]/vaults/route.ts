import { NextRequest, NextResponse } from 'next/server';
import {
  web3Client,
  findSpaceBySlug,
  getTokenPrice,
  getTokenMeta,
  findAllTokens,
  getTokenDecimals,
} from '@hypha-platform/core/server';
import {
  getSpaceRegularTokens,
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
  isHiddenToken,
} from '@hypha-platform/core/client';
import {
  tokenBackingVaultImplementationAbi,
  tokenBackingVaultImplementationAddress,
} from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt, hasEmojiOrLink } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { erc20Abi, formatUnits } from 'viem';

const chainId = 8453;
const vaultAddress =
  tokenBackingVaultImplementationAddress[
    chainId as keyof typeof tokenBackingVaultImplementationAddress
  ];

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const redeemableOnly =
    request.nextUrl.searchParams.get('redeemableOnly') === 'true';
  const emptyRedeemableResponse = {
    web3SpaceId: 0,
    vaults: [],
  };

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space || !canConvertToBigInt(space.web3SpaceId)) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (!redeemableOnly) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );

      if (!hasAccess && response) {
        return response;
      }
    }

    const spaceId = BigInt(space.web3SpaceId as number);

    const rawDbTokens = await findAllTokens({ db }, { search: undefined });
    const dbTokenByAddress = new Map(
      rawDbTokens
        .filter((token) => Boolean(token.address))
        .map((token) => [token.address!.toLowerCase(), token]),
    );
    const dbTokens = rawDbTokens.map((token) => ({
      agreementId: token.agreementId ?? undefined,
      spaceId: token.spaceId ?? undefined,
      name: token.name,
      symbol: token.symbol,
      maxSupply: token.maxSupply,
      type: token.type as
        | 'utility'
        | 'credits'
        | 'ownership'
        | 'voice'
        | 'impact'
        | 'community_currency',
      iconUrl: token.iconUrl ?? undefined,
      transferable: token.transferable,
      isVotingToken: token.isVotingToken,
      address: token.address ?? undefined,
      createdAt: token.createdAt ?? undefined,
    }));

    let spaceTokens: readonly `0x${string}`[] = [];
    try {
      const [regularResult, ownershipResult, decayingResult] =
        await web3Client.multicall({
          contracts: [
            getSpaceRegularTokens({ spaceId }),
            getSpaceOwnershipTokens({ spaceId }),
            getSpaceDecayingTokens({ spaceId }),
          ],
        });
      const regularTokens =
        regularResult.status === 'success' && regularResult.result.length !== 0
          ? regularResult.result
          : [];
      const ownershipTokens =
        ownershipResult.status === 'success' &&
        ownershipResult.result.length !== 0
          ? ownershipResult.result
          : [];
      const decayingTokens =
        decayingResult.status === 'success' &&
        decayingResult.result.length !== 0
          ? decayingResult.result
          : [];
      spaceTokens = (
        [
          ...regularTokens,
          ...ownershipTokens,
          ...decayingTokens,
        ] as `0x${string}`[]
      ).filter((address) => !isHiddenToken(address));
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.shortMessage || JSON.stringify(err);
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        return NextResponse.json(
          {
            error: 'External API rate limit exceeded. Please try again later.',
          },
          { status: 503 },
        );
      }
      console.error('Error fetching space tokens:', err);
      if (redeemableOnly) {
        return NextResponse.json({
          ...emptyRedeemableResponse,
          web3SpaceId: Number(space.web3SpaceId),
        });
      }
      return NextResponse.json(
        { error: 'Failed to fetch vault data.' },
        { status: 500 },
      );
    }

    if (spaceTokens.length === 0) {
      return NextResponse.json({
        web3SpaceId: Number(space.web3SpaceId),
        vaults: [],
      });
    }

    const vaultExistsCalls = spaceTokens.map((spaceToken) => ({
      address: vaultAddress,
      abi: tokenBackingVaultImplementationAbi,
      functionName: 'vaultExists' as const,
      args: [spaceId, spaceToken],
    }));

    const vaultExistsResults = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: vaultExistsCalls,
    });

    const vaultSpaceTokens = spaceTokens.filter(
      (_, i) =>
        vaultExistsResults[i]?.status === 'success' &&
        vaultExistsResults[i]?.result === true,
    );

    if (vaultSpaceTokens.length === 0) {
      return NextResponse.json({
        web3SpaceId: Number(space.web3SpaceId),
        vaults: [],
      });
    }

    const vaultConfigCalls = vaultSpaceTokens.map((spaceToken) => ({
      address: vaultAddress,
      abi: tokenBackingVaultImplementationAbi,
      functionName: 'getVaultConfig' as const,
      args: [spaceId, spaceToken],
    }));

    const vaultConfigResults = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: vaultConfigCalls,
    });

    const filteredVaultSpaceTokens = redeemableOnly
      ? vaultSpaceTokens.filter((_, index) => {
          const configResult = vaultConfigResults[index];
          if (configResult?.status !== 'success') return false;
          const config = configResult.result as {
            redeemEnabled?: boolean;
            redemptionStartDate?: bigint;
          };
          if (!config.redeemEnabled) return false;
          const redemptionStartDateSeconds = Number(
            config.redemptionStartDate ?? 0n,
          );
          return (
            redemptionStartDateSeconds === 0 ||
            redemptionStartDateSeconds * 1000 <= Date.now()
          );
        })
      : vaultSpaceTokens;

    const filteredVaultConfigResults = redeemableOnly
      ? vaultConfigResults.filter((_, index) =>
          filteredVaultSpaceTokens.includes(vaultSpaceTokens[index]!),
        )
      : vaultConfigResults;

    if (filteredVaultSpaceTokens.length === 0) {
      return NextResponse.json({
        web3SpaceId: Number(space.web3SpaceId),
        vaults: [],
      });
    }

    const backingTokensCalls = filteredVaultSpaceTokens.map((spaceToken) => ({
      address: vaultAddress,
      abi: tokenBackingVaultImplementationAbi,
      functionName: 'getBackingTokens' as const,
      args: [spaceId, spaceToken],
    }));

    const backingTokensResults = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: backingTokensCalls,
    });

    const redemptionPriceCalls = filteredVaultSpaceTokens.map((spaceToken) => ({
      address: vaultAddress,
      abi: tokenBackingVaultImplementationAbi,
      functionName: 'getRedemptionPrice' as const,
      args: [spaceId, spaceToken],
    }));

    const redemptionPriceResults = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: redemptionPriceCalls,
    });

    const maxRedemptionCalls = filteredVaultSpaceTokens.map((spaceToken) => ({
      address: vaultAddress,
      abi: tokenBackingVaultImplementationAbi,
      functionName: 'getMaxRedemptionPercentage' as const,
      args: [spaceId, spaceToken],
    }));

    const maxRedemptionResults = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: maxRedemptionCalls,
    });

    const vaultSpaceTokenTotalSupplyCalls = filteredVaultSpaceTokens.map(
      (spaceToken) => ({
        address: spaceToken,
        abi: erc20Abi,
        functionName: 'totalSupply' as const,
        args: [],
      }),
    );

    const vaultSpaceTokenTotalSupplyResults = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: vaultSpaceTokenTotalSupplyCalls,
    });

    const backingBalanceCalls: {
      address: typeof vaultAddress;
      abi: typeof tokenBackingVaultImplementationAbi;
      functionName: 'getBackingBalance';
      args: [bigint, `0x${string}`, `0x${string}`];
    }[] = [];

    for (let i = 0; i < filteredVaultSpaceTokens.length; i++) {
      const backingResult = backingTokensResults[i];
      const backingTokens =
        backingResult?.status === 'success'
          ? (backingResult.result as `0x${string}`[])
          : [];
      for (const backingToken of backingTokens) {
        const spaceToken = filteredVaultSpaceTokens[i];
        if (spaceToken) {
          backingBalanceCalls.push({
            address: vaultAddress,
            abi: tokenBackingVaultImplementationAbi,
            functionName: 'getBackingBalance',
            args: [spaceId, spaceToken, backingToken],
          });
        }
      }
    }

    const backingBalanceResults =
      backingBalanceCalls.length > 0
        ? await web3Client.multicall({
            allowFailure: true,
            blockTag: 'safe',
            contracts: backingBalanceCalls,
          })
        : [];

    const allTokenAddresses = new Set<string>();
    filteredVaultSpaceTokens.forEach((t) =>
      allTokenAddresses.add(t.toLowerCase()),
    );
    backingBalanceCalls.forEach((c) =>
      allTokenAddresses.add(c.args[2].toLowerCase()),
    );

    const tokenMetaPromises = Array.from(allTokenAddresses).map((addr) =>
      getTokenMeta(addr as `0x${string}`, dbTokens).catch(() => null),
    );
    const tokenMetaResults = await Promise.all(tokenMetaPromises);
    const tokenMetaMap = new Map<
      string,
      Awaited<ReturnType<typeof getTokenMeta>>
    >();
    Array.from(allTokenAddresses).forEach((addr, i) => {
      const meta = tokenMetaResults[i];
      if (meta && !hasEmojiOrLink(meta.name) && !hasEmojiOrLink(meta.symbol)) {
        tokenMetaMap.set(addr.toLowerCase(), meta);
      }
    });

    const allAddresses = Array.from(allTokenAddresses) as `0x${string}`[];
    const prices = await getTokenPrice(allAddresses);

    const resolveTokenPrice = (tokenAddress: `0x${string}`): number => {
      const marketPrice = prices[tokenAddress] ?? 0;
      if (marketPrice > 0) {
        return marketPrice;
      }
      const dbToken = dbTokenByAddress.get(tokenAddress.toLowerCase());
      const dbReferencePrice = Number(dbToken?.referencePrice ?? 0);
      return Number.isFinite(dbReferencePrice) && dbReferencePrice > 0
        ? dbReferencePrice
        : 0;
    };

    const decimalsMap = new Map<string, number>();
    const decimalsResults = await Promise.all(
      Array.from(allTokenAddresses).map(async (addr) => {
        try {
          const decimals = await getTokenDecimals(addr as `0x${string}`);
          return { addr: addr.toLowerCase(), decimals };
        } catch {
          return { addr: addr.toLowerCase(), decimals: 18 };
        }
      }),
    );
    decimalsResults.forEach(({ addr, decimals }) => {
      decimalsMap.set(addr, decimals);
    });

    const totalSupplyByAddress = new Map<string, bigint>();
    const allTokenAddressesForSupply = Array.from(
      allTokenAddresses,
    ) as `0x${string}`[];
    const tokenTotalSupplyResults =
      allTokenAddressesForSupply.length > 0
        ? await web3Client.multicall({
            allowFailure: true,
            blockTag: 'safe',
            contracts: allTokenAddressesForSupply.map((address) => ({
              address,
              abi: erc20Abi,
              functionName: 'totalSupply' as const,
              args: [],
            })),
          })
        : [];
    allTokenAddressesForSupply.forEach((address, idx) => {
      const result = tokenTotalSupplyResults[idx];
      totalSupplyByAddress.set(
        address.toLowerCase(),
        result?.status === 'success' ? result.result : 0n,
      );
    });

    // callIdx follows the exact insertion order used when building
    // backingBalanceCalls (vaultSpaceTokens -> backingTokens).
    let callIdx = 0;
    const vaults = filteredVaultSpaceTokens.map((spaceToken, vaultIdx) => {
      const spaceTokenMeta = tokenMetaMap.get(spaceToken.toLowerCase());
      const tokenName = spaceTokenMeta?.name ?? 'Unknown';
      const tokenSymbol = spaceTokenMeta?.symbol ?? '???';

      const backingTokens =
        backingTokensResults[vaultIdx]?.status === 'success'
          ? (backingTokensResults[vaultIdx].result as `0x${string}`[])
          : [];

      const collaterals: {
        address: string;
        symbol: string;
        name: string;
        icon: string;
        value: number;
        usdEqual: number;
        tokenPrice: number;
        supply?: {
          total: number;
        };
        space?: {
          slug: string;
          title: string;
        };
        createdAt?: Date;
      }[] = [];

      let totalUsd = 0;

      for (const backingToken of backingTokens) {
        const balanceResult = backingBalanceResults[callIdx];
        callIdx++;
        const balance =
          balanceResult?.status === 'success' ? balanceResult.result : 0n;
        const decimals = decimalsMap.get(backingToken.toLowerCase()) ?? 18;
        const value = Number(formatUnits(balance, decimals));
        const price = resolveTokenPrice(backingToken);
        const usdEqual = value * price;
        totalUsd += usdEqual;

        const meta = tokenMetaMap.get(backingToken.toLowerCase());
        const backingTokenTotalSupply =
          totalSupplyByAddress.get(backingToken.toLowerCase()) ?? 0n;
        const backingTokenSupply =
          backingTokenTotalSupply > 0n
            ? {
                total: Number(formatUnits(backingTokenTotalSupply, decimals)),
              }
            : undefined;
        collaterals.push({
          address: backingToken,
          symbol: meta?.symbol ?? '???',
          name: meta?.name ?? 'Unknown',
          icon: meta?.icon ?? '/placeholder/token-icon.svg',
          value,
          usdEqual,
          tokenPrice: price,
          supply: backingTokenSupply,
          space: meta?.space,
          createdAt: meta?.createdAt,
        });
      }

      const vaultConfig = filteredVaultConfigResults[vaultIdx];
      const vaultConfigResult =
        vaultConfig?.status === 'success' ? vaultConfig.result : undefined;
      const redemptionEnabled = Boolean(
        (vaultConfigResult as { redeemEnabled?: boolean } | undefined)
          ?.redeemEnabled,
      );

      const redemptionPriceResult = redemptionPriceResults[vaultIdx];
      const redemptionPriceRaw =
        redemptionPriceResult?.status === 'success'
          ? redemptionPriceResult.result?.[0] ?? 0n
          : 0n;
      const redemptionPrice =
        Number(redemptionPriceRaw) > 0
          ? Number(redemptionPriceRaw) / 1_000_000
          : 0;
      const redemptionCurrencyFeed =
        redemptionPriceResult?.status === 'success'
          ? redemptionPriceResult.result?.[1]
          : undefined;
      const maxRedemptionResult = maxRedemptionResults[vaultIdx];
      const maxRedemptionBps =
        maxRedemptionResult?.status === 'success'
          ? maxRedemptionResult.result?.[0] ?? 0n
          : 0n;
      const maxRedemptionPeriodDays =
        maxRedemptionResult?.status === 'success'
          ? Number(maxRedemptionResult.result?.[1] ?? 0n)
          : 0;
      const minimumBackingPercent =
        Number(
          (vaultConfigResult as { minimumBackingBps?: bigint } | undefined)
            ?.minimumBackingBps ?? 0n,
        ) / 100;
      const redemptionStartDateSeconds = Number(
        (vaultConfigResult as { redemptionStartDate?: bigint } | undefined)
          ?.redemptionStartDate ?? 0n,
      );
      const redemptionStartDate =
        redemptionStartDateSeconds > 0
          ? new Date(redemptionStartDateSeconds * 1000)
          : undefined;

      const spaceTokenTotalSupplyResult =
        vaultSpaceTokenTotalSupplyResults[vaultIdx];
      const spaceTokenTotalSupply =
        spaceTokenTotalSupplyResult?.status === 'success'
          ? spaceTokenTotalSupplyResult.result
          : 0n;
      const spaceTokenDecimals =
        decimalsMap.get(spaceToken.toLowerCase()) ?? 18;
      const totalIssuance = Number(
        formatUnits(spaceTokenTotalSupply, spaceTokenDecimals),
      );

      const treasuryPrice = resolveTokenPrice(spaceToken);
      const backingReferencePrice =
        redemptionEnabled && redemptionPrice > 0
          ? redemptionPrice
          : treasuryPrice;
      const backingDenominator = totalIssuance * backingReferencePrice;
      const backingPercent =
        backingDenominator > 0 ? (totalUsd / backingDenominator) * 100 : 0;

      return {
        spaceToken,
        tokenName,
        tokenSymbol,
        tokenIcon: spaceTokenMeta?.icon ?? '/placeholder/token-icon.svg',
        totalUsd,
        backingPercent,
        redemptionEnabled,
        redemptionPrice,
        redemptionCurrencyFeed,
        minimumBackingPercent,
        maxRedemptionPercent: Number(maxRedemptionBps) / 100,
        maxRedemptionPeriodDays,
        redemptionStartDate,
        whitelistEnabled: Boolean(
          (vaultConfigResult as { whitelistEnabled?: boolean } | undefined)
            ?.whitelistEnabled,
        ),
        collaterals,
      };
    });

    return NextResponse.json({
      web3SpaceId: Number(space.web3SpaceId),
      vaults,
    });
  } catch (error) {
    console.error('Failed to fetch vaults:', error);
    if (redeemableOnly) {
      return NextResponse.json(emptyRedeemableResponse);
    }
    return NextResponse.json(
      { error: 'Failed to fetch vaults.' },
      { status: 500 },
    );
  }
}
