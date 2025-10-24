import { NextRequest, NextResponse } from 'next/server';
import {
  web3Client,
  findSpaceBySlug,
  getTokenPrice,
  getTokenBalancesByAddress,
  getBalance,
  getTokenMeta,
  findAllTokens,
  getSupply,
} from '@hypha-platform/core/server';
import {
  getSpaceDetails,
  getSpaceRegularTokens,
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
  TOKENS,
  Token,
  ALLOWED_SPACES,
  getTokenDecimals,
} from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { hasEmojiOrLink } from '@hypha-platform/ui-utils';

const EVT_TOKEN_ADDRESS = '0xd8724e6609838a54f7e505679bf6818f1a3f2d40';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    // TODO: implement authorization
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaceId = BigInt(space.web3SpaceId as number);

    const rawDbTokens = await findAllTokens({ db }, { search: undefined });
    const dbTokens = rawDbTokens.map((token) => ({
      agreementId: token.agreementId ?? undefined,
      spaceId: token.spaceId ?? undefined,
      name: token.name,
      symbol: token.symbol,
      maxSupply: token.maxSupply,
      type: token.type as 'utility' | 'credits' | 'ownership' | 'voice',
      iconUrl: token.iconUrl ?? undefined,
      transferable: token.transferable,
      isVotingToken: token.isVotingToken,
      address: token.address ?? undefined,
      createdAt: token.createdAt ?? undefined,
    }));

    let spaceDetails;
    let spaceTokens;
    try {
      spaceDetails = await web3Client.readContract(
        getSpaceDetails({ spaceId }),
      );

      spaceTokens = await web3Client.multicall({
        contracts: [
          getSpaceRegularTokens({ spaceId }),
          getSpaceOwnershipTokens({ spaceId }),
          getSpaceDecayingTokens({ spaceId }),
        ],
      });
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.shortMessage || JSON.stringify(err);
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        console.warn(
          'Rate limit exceeded when calling readContract:',
          errorMessage,
        );
        return NextResponse.json(
          {
            error: 'External API rate limit exceeded. Please try again later.',
          },
          { status: 503 },
        );
      }

      console.error('Error while calling readContract:', err);
      return NextResponse.json(
        { error: 'Failed to fetch contract data.' },
        { status: 500 },
      );
    }

    const spaceAddress = spaceDetails[9] as `0x${string}`;
    if (!spaceAddress || !/^0x[a-fA-F0-9]{40}$/.test(spaceAddress)) {
      return NextResponse.json(
        { error: 'Invalid or missing executor address' },
        { status: 400 },
      );
    }

    let externalTokens: any[] = [];
    try {
      externalTokens = await getTokenBalancesByAddress(spaceAddress);
    } catch (error: unknown) {
      console.warn('Failed to fetch external token balances:', error);
    }

    const parsedExternalTokens: Token[] = externalTokens
      .filter(
        (token) =>
          token?.tokenAddress &&
          /^0x[a-fA-F0-9]{40}$/i.test(token.tokenAddress),
      )
      .map((token) => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unnamed',
        address: token.tokenAddress as `0x${string}`,
        icon: token.logo || '/placeholder/token-icon.svg',
        type: 'utility' as const,
      }));

    spaceTokens = spaceTokens
      .filter(
        (response) =>
          response.status === 'success' && response.result.length !== 0,
      )
      .map(({ result }) => result)
      .flat() as `0x${string}`[];

    const addressMap = new Map<string, Token>();

    const filteredTokens = TOKENS.filter((token) =>
      token.symbol === 'HYPHA' ? ALLOWED_SPACES.includes(spaceAddress) : true,
    );

    filteredTokens.forEach((token) =>
      addressMap.set(token.address.toLowerCase(), token),
    );

    spaceTokens.forEach((address) => {
      if (!addressMap.has(address.toLowerCase())) {
        addressMap.set(address.toLowerCase(), {
          symbol: '',
          name: '',
          address,
          icon: '/placeholder/token-icon.svg',
          type: 'utility' as const,
        });
      }
    });

    parsedExternalTokens.forEach((token) => {
      if (!addressMap.has(token.address.toLowerCase())) {
        addressMap.set(token.address.toLowerCase(), token);
      }
    });

    const allTokens: Token[] = Array.from(addressMap.values());

    let prices: Record<string, number | undefined> = {};
    try {
      prices = await getTokenPrice(allTokens.map(({ address }) => address));
    } catch (error: unknown) {
      console.error('Failed to fetch token prices:', error);
    }

    const assets = await Promise.all(
      allTokens.map(async (token) => {
        try {
          const meta = await getTokenMeta(token.address, dbTokens);
          if (hasEmojiOrLink(meta.name) || hasEmojiOrLink(meta.symbol)) {
            return null;
          }
          const { amount } = await getBalance(token.address, spaceAddress);
          let totalSupply: bigint | undefined;
          try {
            const supply = await getSupply(token.address);
            totalSupply = supply.totalSupply;
          } catch (err) {
            console.warn(
              `Failed to fetch supply for token ${token.address}: ${err}`,
            );
          }
          let rate = prices[token.address] || 0;
          if (token.address.toLowerCase() === EVT_TOKEN_ADDRESS) {
            rate = 1;
          }
          const decimals = await getTokenDecimals(token.address);
          return {
            ...meta,
            address: token.address,
            value: amount,
            usdEqual: rate * amount,
            chartData: [],
            transactions: [],
            closeUrl: [],
            slug: '',
            supply: totalSupply
              ? {
                  total: Number(totalSupply / 10n ** BigInt(decimals)),
                }
              : undefined,
            space: meta.space
              ? {
                  slug: meta.space.slug,
                  title: meta.space.title,
                }
              : undefined,
          };
        } catch (err) {
          console.warn(`Skipping token ${token.address}: ${err}`);
          return null;
        }
      }),
    );

    const validAssets = assets.filter((a) => a !== null) as NonNullable<
      (typeof assets)[0]
    >[];

    const sorted = validAssets.sort((a, b) =>
      a.usdEqual === b.usdEqual ? b.value - a.value : b.usdEqual - a.usdEqual,
    );

    return NextResponse.json({
      assets: sorted,
      balance: sorted.reduce((sum, asset) => sum + asset.usdEqual, 0),
    });
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets.' },
      { status: 500 },
    );
  }
}
