import {
  BankOnboardingError,
  getSpaceBankVirtualAccounts,
  provisionSpaceBankVirtualAccount,
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

  try {
    const authResult = await authenticateBankCustomerRequest(
      request,
      spaceSlug,
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    const accounts = await getSpaceBankVirtualAccounts(authResult.space, {
      db,
    });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('banking/virtual-accounts GET failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch virtual accounts' },
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
    const result = await provisionSpaceBankVirtualAccount(
      {
        spaceSlug,
        authToken,
        currency: parsed.data.currency,
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

    console.error('banking/virtual-accounts POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to provision virtual account' },
      { status: 500 },
    );
  }
}
