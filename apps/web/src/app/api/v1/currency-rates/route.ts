import { NextResponse } from 'next/server';
import { getUsdRates } from '@hypha-platform/core/server';

/**
 * Public FX rates, quoted in USD, for rendering balances in a member's chosen
 * currency. No auth: these are Chainlink market rates, not user data, and the
 * space treasury total needs them for signed-out visitors too.
 */
export async function GET() {
  try {
    const rates = await getUsdRates();
    return NextResponse.json({ base: 'USD', rates });
  } catch (error) {
    console.error('Failed to fetch currency rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currency rates.' },
      { status: 500 },
    );
  }
}
