import {
  BankOnboardingError,
  createPersonalBankTransfer,
  getPersonalBankTransfers,
  getPersonalTransferRailOptions,
  schemaCreateBankTransfer,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import { authenticatePersonalBankCustomerRequest } from '@web/lib/bank-customers/authenticate-personal-bank-customer-request';

type Params = { personSlug: string };

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { personSlug } = await params;
  const { searchParams } = new URL(request.url);

  try {
    const authResult = await authenticatePersonalBankCustomerRequest(
      request,
      personSlug,
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    if (searchParams.get('mode') === 'transfer-options') {
      const options = await getPersonalTransferRailOptions(authResult.person, {
        db,
      });
      return NextResponse.json({ options });
    }

    const limit = Number.parseInt(searchParams.get('limit') ?? '25', 10);
    const startingAfter = searchParams.get('starting_after') ?? undefined;
    const endingBefore = searchParams.get('ending_before') ?? undefined;

    const result = await getPersonalBankTransfers(
      authResult.person,
      {
        limit: Number.isFinite(limit) ? limit : 25,
        startingAfter,
        endingBefore,
      },
      { db },
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error(
      'people/banking/transfers GET failed:',
      error instanceof Error ? error.message : error,
    );
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
  const { personSlug } = await params;

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

  try {
    const authResult = await authenticatePersonalBankCustomerRequest(
      request,
      personSlug,
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    const result = await createPersonalBankTransfer(
      {
        personSlug,
        authToken: authResult.authToken,
        railKey: parsed.data.railKey,
        corridorKey: parsed.data.corridorKey,
        currency: parsed.data.currency,
        amount: parsed.data.amount,
        destinationCurrency: parsed.data.destinationCurrency,
        idempotencyKey: parsed.data.idempotencyKey,
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
      'people/banking/transfers POST failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 },
    );
  }
}
