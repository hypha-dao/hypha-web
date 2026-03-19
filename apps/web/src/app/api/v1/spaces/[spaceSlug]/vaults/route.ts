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

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space || !canConvertToBigInt(space.web3SpaceId)) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );

    if (!hasAccess && response) {
      return response;
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
      spaceTokens = [
        ...regularTokens,
        ...ownershipTokens,
        ...decayingTokens,
      ] as `0x${string}`[];
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
      return NextResponse.json(
        { error: 'Failed to fetch vault data.' },
        { status: 500 },
      );
    }

    if (spaceTokens.length === 0) {
      return NextResponse.json({ vaults: [] });
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
      return NextResponse.json({ vaults: [] });
    }

    const backingTokensCalls = vaultSpaceTokens.map((spaceToken) => ({
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

    const redemptionPriceCalls = vaultSpaceTokens.map((spaceToken) => ({
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

    const vaultSpaceTokenTotalSupplyCalls = vaultSpaceTokens.map(
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

    for (let i = 0; i < vaultSpaceTokens.length; i++) {
      const backingResult = backingTokensResults[i];
      const backingTokens =
        backingResult?.status === 'success'
          ? (backingResult.result as `0x${string}`[])
          : [];
      for (const backingToken of backingTokens) {
        const spaceToken = vaultSpaceTokens[i];
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
    vaultSpaceTokens.forEach((t) => allTokenAddresses.add(t.toLowerCase()));
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
    for (const addr of allTokenAddresses) {
      try {
        const decimals = await getTokenDecimals(addr as `0x${string}`);
        decimalsMap.set(addr.toLowerCase(), decimals);
      } catch {
        decimalsMap.set(addr.toLowerCase(), 18);
      }
    }

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

    let callIdx = 0;
    const vaults = vaultSpaceTokens.map((spaceToken, vaultIdx) => {
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

      const vaultConfig = vaultConfigResults[vaultIdx];
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
        collaterals,
      };
    });

    return NextResponse.json({ vaults });
  } catch (error) {
    console.error('Failed to fetch vaults:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vaults.' },
      { status: 500 },
    );
  }
}
