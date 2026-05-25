import {
  BankOnboardingError,
  buildBankingKycRedirectUri,
  createSpaceBankTransfer,
  getSpaceBankTransfers,
  schemaCreateBankTransfer,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import {
  authenticateBankCustomerRequest,
  extractBearerToken,
} from '@web/lib/bank-customers/authenticate-bank-customer-request';
import { getLocaleFromRequest } from '@web/lib/bank-customers/banking-request-locale';

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

    const transfers = await getSpaceBankTransfers(authResult.space, { db });
    return NextResponse.json(transfers);
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
    const lang = getLocaleFromRequest(request);
    const result = await createSpaceBankTransfer(
      {
        spaceSlug,
        authToken,
        corridorKey: parsed.data.corridorKey,
        currency: parsed.data.currency,
        amount: parsed.data.amount,
        legalName: parsed.data.legalName,
        contactEmail: parsed.data.contactEmail,
        redirectUri: buildBankingKycRedirectUri(lang, spaceSlug),
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
