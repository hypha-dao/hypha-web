import {
  BankOnboardingError,
  createSpaceBankVirtualAccount,
  getAddAccountRailOptions,
  getSpaceBankVirtualAccounts,
  schemaProvisionVirtualAccount,
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

    if (searchParams.get('mode') === 'add-options') {
      const options = await getAddAccountRailOptions(authResult.space, { db });
      return NextResponse.json({ options });
    }

    const limit = Number.parseInt(searchParams.get('limit') ?? '25', 10);
    const startingAfter = searchParams.get('starting_after') ?? undefined;

    const result = await getSpaceBankVirtualAccounts(
      authResult.space,
      {
        spaceSlug,
        limit: Number.isFinite(limit) ? limit : 25,
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
      'banking/accounts GET failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  const authResult = await authenticateBankCustomerRequest(request, spaceSlug);
  if (!authResult.ok) {
    return authResult.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schemaProvisionVirtualAccount.safeParse(body);
  if (!parsed.success) {
    console.error(
      'banking/accounts POST validation failed:',
      JSON.stringify(parsed.error.format(), null, 2),
    );
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const supportedRailsEnv =
    process.env.NEXT_PUBLIC_BANKING_SUPPORTED_DEPOSIT_RAILS?.trim();
  if (supportedRailsEnv) {
    const supportedCurrencies = new Set(
      supportedRailsEnv
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!supportedCurrencies.has(parsed.data.currency.toLowerCase())) {
      return NextResponse.json(
        { error: 'This deposit rail is not currently enabled.' },
        { status: 403 },
      );
    }
  }

  const authToken = extractBearerToken(request);
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await createSpaceBankVirtualAccount(
      {
        spaceSlug,
        authToken,
        currency: parsed.data.currency,
        destinationCurrency: parsed.data.destinationCurrency,
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
      'banking/accounts POST failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to create bank account' },
      { status: 500 },
    );
  }
}
