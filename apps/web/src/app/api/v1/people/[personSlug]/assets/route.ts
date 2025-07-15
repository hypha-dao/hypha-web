import { NextRequest, NextResponse } from 'next/server';
import { createPeopleService } from '@hypha-platform/core/server';
import { TOKENS, getBalance, getTokenMeta } from '@core/common';
import { getTokenPrice } from '@core/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personSlug: string }> },
) {
  const { personSlug } = await params;
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  try {
    const peopleService = createPeopleService({ authToken });
    const person = await peopleService.findBySlug({ slug: personSlug });

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
    let prices: Record<string, number | undefined> = {};
    try {
      prices = await getTokenPrice(TOKENS.map(({ address }) => address));
    } catch (error: unknown) {
      console.error('Failed to fetch prices of tokens with Moralis:', error);
    }

    const assets = await Promise.all(
      TOKENS.map(async (token) => {
        const meta = await getTokenMeta(token.address);
        const { amount } = await getBalance(token.address, address);
        const rate = prices[token.address] || 0;
        return {
          ...meta,
          value: amount,
          usdEqual: rate * amount,
          chartData: [],
          transactions: [],
          closeUrl: [],
          slug: '',
        };
      }),
    );

    const sorted = assets.sort((a, b) =>
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
