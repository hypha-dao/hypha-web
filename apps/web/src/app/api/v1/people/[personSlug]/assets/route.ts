import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenPrice,
  findPersonBySlug,
  getDb,
  getTokenBalancesByAddress,
  findAllTokens,
  getBalance,
  getTokenMeta,
  getSupply,
} from '@hypha-platform/core/server';
import {
  TOKENS,
  Token,
  validTokenTypes,
  TokenType,
} from '@hypha-platform/core/client';
import { headers } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personSlug: string }> },
) {
  const { personSlug } = await params;
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const person = await findPersonBySlug(
      { slug: personSlug },
      { db: getDb({ authToken }) },
    );
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const address = person.address as `0x${string}`;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid or missing address' },
        { status: 400 },
      );
    }

    let externalTokens: any[] = [];
    try {
      externalTokens = await getTokenBalancesByAddress(address);
    } catch (error) {
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

    const filteredExternalTokens = parsedExternalTokens.filter((token) => {
      const hasEmojiOrLink = (str: string) => {
        const emojiRegex = /[\p{Emoji}]/u;
        const linkRegex = /(https?:\/\/|www\.|t\.me\/)/i;
        return emojiRegex.test(str) || linkRegex.test(str);
      };
      return !hasEmojiOrLink(token.symbol) && !hasEmojiOrLink(token.name);
    });

    const addressMap = new Map<string, Token>();
    TOKENS.forEach((token) =>
      addressMap.set(token.address.toLowerCase(), token),
    );
    filteredExternalTokens.forEach((token) => {
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

    const rawDbTokens = await findAllTokens(
      { db: getDb({ authToken }) },
      { search: undefined },
    );
    const dbTokens = rawDbTokens.map((token) => ({
      agreementId: token.agreementId ?? undefined,
      spaceId: token.spaceId ?? undefined,
      name: token.name,
      symbol: token.symbol,
      maxSupply: token.maxSupply,
      type: validTokenTypes.includes(token.type as TokenType)
        ? (token.type as TokenType)
        : 'utility',
      iconUrl: token.iconUrl ?? undefined,
      transferable: token.transferable,
      isVotingToken: token.isVotingToken,
      address: token.address ?? undefined,
    }));

    const assets = await Promise.all(
      allTokens.map(async (token) => {
        try {
          const meta = await getTokenMeta(token.address, dbTokens);
          const { amount } = await getBalance(token.address, address);
          let totalSupply: bigint | undefined;
          try {
            const supply = await getSupply(token.address);
            totalSupply = supply.totalSupply;
          } catch (err) {
            console.warn(
              `Failed to fetch supply for token ${token.address}: ${err}`,
            );
          }
          const rate = prices[token.address] || 0;
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
                  total: Number(totalSupply / 10n ** 18n),
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
    console.error('Failed to fetch user assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user assets.' },
      { status: 500 },
    );
  }
}
