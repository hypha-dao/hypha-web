import 'server-only';

import { findAllSpaces } from '../../space/server/queries';
import { web3Client } from '../../common/server/web3-rpc/client';
import { getSpaceDetails } from '../../space/shared/web3/get-space-details';
import { getTokenBalancesByAddress, getTokenPrice } from '../../common/server';
import type { DbConfig } from '../../server';
import { formatEther } from 'viem';

export type PlatformSpaceAssetSummary = {
  spaceId: number;
  slug: string;
  title: string;
  balanceUsd: number;
  assetCount: number;
  topAssets: Array<{
    symbol: string;
    name: string;
    value: number;
    usdEqual: number;
  }>;
};

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function getSpaceAssetSummary(space: {
  id: number;
  slug: string;
  title: string;
  web3SpaceId: number | null;
}): Promise<PlatformSpaceAssetSummary | null> {
  if (space.web3SpaceId == null || space.web3SpaceId <= 0) {
    return null;
  }

  try {
    const spaceId = BigInt(space.web3SpaceId);
    const spaceDetails = await web3Client.readContract(
      getSpaceDetails({ spaceId }),
    );
    const executor = spaceDetails[9] as `0x${string}`;
    if (!executor || !/^0x[a-fA-F0-9]{40}$/.test(executor)) {
      return {
        spaceId: space.id,
        slug: space.slug,
        title: space.title,
        balanceUsd: 0,
        assetCount: 0,
        topAssets: [],
      };
    }

    const externalTokens = await getTokenBalancesByAddress(executor).catch(
      () => [],
    );
    const tokensWithBalance = externalTokens.filter(
      (token) => token.balance > 0,
    );
    const tokenAddresses = tokensWithBalance
      .slice(0, 12)
      .map((token) => token.tokenAddress as `0x${string}`);

    let prices: Record<string, number> = {};
    if (tokenAddresses.length > 0) {
      try {
        prices = await getTokenPrice(tokenAddresses);
      } catch {
        prices = {};
      }
    }

    const tokenAssets = tokensWithBalance.slice(0, 12).map((token) => {
      const rate = prices[token.tokenAddress] ?? 0;
      const usdEqual = rate * token.balance;
      return {
        symbol: token.symbol,
        name: token.name,
        value: token.balance,
        usdEqual,
      };
    });

    const ethBalance = await web3Client.getBalance({ address: executor });
    const ethAmount = Number(formatEther(ethBalance));
    const wethAddress = '0x4200000000000000000000000000000000000006' as const;
    let ethUsd = 0;
    if (ethAmount > 0) {
      try {
        const ethPrices = await getTokenPrice([wethAddress]);
        ethUsd = (ethPrices[wethAddress] ?? 0) * ethAmount;
      } catch {
        ethUsd = 0;
      }
    }

    const topAssets = [
      ...(ethAmount > 0
        ? [
            {
              symbol: 'ETH',
              name: 'Ether',
              value: ethAmount,
              usdEqual: ethUsd,
            },
          ]
        : []),
      ...tokenAssets,
    ]
      .filter((asset) => asset.value > 0)
      .sort((a, b) => b.usdEqual - a.usdEqual)
      .slice(0, 4);

    const balanceUsd = topAssets.reduce(
      (sum, asset) => sum + asset.usdEqual,
      0,
    );

    return {
      spaceId: space.id,
      slug: space.slug,
      title: space.title,
      balanceUsd,
      assetCount: topAssets.length,
      topAssets,
    };
  } catch (error) {
    console.warn(
      `[platform-dashboard] Failed asset summary for ${space.slug}`,
      error,
    );
    return {
      spaceId: space.id,
      slug: space.slug,
      title: space.title,
      balanceUsd: 0,
      assetCount: 0,
      topAssets: [],
    };
  }
}

export async function getPlatformAssetsSummary({ db }: DbConfig) {
  const spaces = await findAllSpaces(
    { db },
    { parentOnly: false, omitSandbox: true, omitArchived: true },
  );

  const summaries = (
    await mapInBatches(spaces, 4, (space) => getSpaceAssetSummary(space))
  ).filter((summary): summary is PlatformSpaceAssetSummary => summary != null);

  const sorted = summaries.sort((a, b) => b.balanceUsd - a.balanceUsd);
  const totalBalanceUsd = sorted.reduce(
    (sum, space) => sum + space.balanceUsd,
    0,
  );

  return {
    totalBalanceUsd,
    spaceCount: sorted.length,
    spaces: sorted,
  };
}
