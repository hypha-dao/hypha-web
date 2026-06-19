import {
  BankOnboardingError,
  createSpaceBankPayoutAccount,
  getSpaceBankPayoutAccounts,
  schemaCreatePayoutAccount,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import {
  authenticateBankCustomerRequest,
  extractBearerToken,
} from '@web/lib/bank-customers/authenticate-bank-customer-request';

type Params = { spaceSlug: string };

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  const { searchParams } = new URL(request.url);

  try {
    const authResult = await authenticateBankCustomerRequest(
      request,
      spaceSlug,
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '25', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 25;
    const startingAfter = searchParams.get('starting_after') ?? undefined;

    const result = await getSpaceBankPayoutAccounts(
      authResult.space,
      {
        spaceSlug,
        limit,
        startingAfter,
      },
      { db },
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof BankOnboardingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(
      'banking/payout-accounts GET failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch payout accounts' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schemaCreatePayoutAccount.safeParse(body);
  if (!parsed.success) {
    console.error(
      'banking/payout-accounts POST validation failed:',
      JSON.stringify(parsed.error.format(), null, 2),
    );
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const supportedRailsEnv =
    process.env.NEXT_PUBLIC_BANKING_SUPPORTED_PAYOUT_RAILS?.trim();
  if (supportedRailsEnv) {
    const supportedRails = new Set(
      supportedRailsEnv
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!supportedRails.has(parsed.data.railKey.toLowerCase())) {
      return NextResponse.json(
        { error: 'This payout rail is not currently enabled.' },
        { status: 403 },
      );
    }
  }

  try {
    const authResult = await authenticateBankCustomerRequest(
      request,
      spaceSlug,
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await createSpaceBankPayoutAccount(
      {
        spaceSlug,
        authToken,
        ...parsed.data,
      },
      { db },
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof BankOnboardingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(
      'banking/payout-accounts POST failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to create payout account' },
      { status: 500 },
    );
  }
}
