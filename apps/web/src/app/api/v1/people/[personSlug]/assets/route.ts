import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenPrice,
  findPersonBySlug,
  getDb,
  getWalletTokenBalancesPriceByAddress,
} from '@hypha-platform/core/server';
import {
  TOKENS,
  getBalance,
  getTokenMeta,
  Token,
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
      externalTokens = await getWalletTokenBalancesPriceByAddress(address);
    } catch (error) {
      console.warn('Failed to fetch external token balances:', error);
    }

    const parsedExternalTokens: Token[] = externalTokens
      .filter(
        (token) =>
          token?.tokenAddress?.lowercase &&
          /^0x[a-fA-F0-9]{40}$/i.test(token.tokenAddress.lowercase),
      )
      .map((token) => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unnamed',
        address: token?.tokenAddress?.lowercase as `0x${string}`,
        icon: token.logo || '/placeholder/token-icon.png',
        type: 'utility',
      }));

    const allTokens: Token[] = [...TOKENS, ...parsedExternalTokens];

    let prices: Record<string, number | undefined> = {};
    try {
      prices = await getTokenPrice(allTokens.map(({ address }) => address));
    } catch (error: unknown) {
      console.error('Failed to fetch prices of tokens with Moralis:', error);
    }

    const assets = await Promise.all(
      allTokens.map(async (token) => {
        try {
          const meta = await getTokenMeta(token.address);
          const { amount } = await getBalance(token.address, address);
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
