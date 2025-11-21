import { NextRequest, NextResponse } from 'next/server';
import { getSupply, getTokenDecimals } from '@hypha-platform/core/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: `0x${string}` }> },
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json(
      { error: 'Missing token parameter' },
      { status: 400 },
    );
  }

  try {
    const [supplyData, decimals] = await Promise.all([
      getSupply(token),
      getTokenDecimals(token),
    ]);

    const totalSupply = supplyData.totalSupply;
    const formattedSupply = Number(totalSupply / 10n ** BigInt(decimals));

    return NextResponse.json({ supply: formattedSupply });
  } catch (error: any) {
    console.error(`Error fetching token supply for ${token}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
