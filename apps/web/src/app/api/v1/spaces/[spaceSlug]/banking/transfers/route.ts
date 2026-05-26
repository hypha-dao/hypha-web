import {
  BankOnboardingError,
  createSpaceBankTransfer,
  getSpaceBankTransfers,
  getTransferRailOptions,
  schemaCreateBankTransfer,
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

    if (searchParams.get('mode') === 'transfer-options') {
      const options = await getTransferRailOptions(authResult.space, { db });
      return NextResponse.json({ options });
    }

    const limit = Number.parseInt(searchParams.get('limit') ?? '25', 10);
    const startingAfter = searchParams.get('starting_after') ?? undefined;
    const endingBefore = searchParams.get('ending_before') ?? undefined;

    const result = await getSpaceBankTransfers(
      authResult.space,
      {
        spaceSlug,
        limit: Number.isFinite(limit) ? limit : 25,
        startingAfter,
        endingBefore,
      },
      { db },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('banking/transfers GET failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
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

  const parsed = schemaCreateBankTransfer.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const authToken = extractBearerToken(request);
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await createSpaceBankTransfer(
      {
        spaceSlug,
        authToken,
        railKey: parsed.data.railKey,
        corridorKey: parsed.data.corridorKey,
        currency: parsed.data.currency,
        amount: parsed.data.amount,
        destinationCurrency: parsed.data.destinationCurrency,
      },
      { db },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BankOnboardingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error('banking/transfers POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 },
    );
  }
}
