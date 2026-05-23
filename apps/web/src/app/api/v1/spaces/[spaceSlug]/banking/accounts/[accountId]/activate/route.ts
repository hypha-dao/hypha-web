import {
  BANK_SETUP_FAILED_USER_MESSAGE,
  BankOnboardingError,
  activateSpaceBankVirtualAccount,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import {
  authenticateBankCustomerRequest,
  extractBearerToken,
} from '@web/lib/bank-customers/authenticate-bank-customer-request';

type Params = { spaceSlug: string; accountId: string };

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, accountId } = await params;
  const id = Number.parseInt(accountId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 });
  }

  const authResult = await authenticateBankCustomerRequest(request, spaceSlug);
  if (!authResult.ok) {
    return authResult.response;
  }

  const authToken = extractBearerToken(request);
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await activateSpaceBankVirtualAccount(
      { spaceSlug, authToken, accountId: id },
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

    console.error('banking/accounts/activate POST failed:', error);
    return NextResponse.json(
      { error: BANK_SETUP_FAILED_USER_MESSAGE },
      { status: 500 },
    );
  }
}
