import {
  BankOnboardingError,
  activateSpaceBankTransfer,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import {
  authenticateBankCustomerRequest,
  extractBearerToken,
} from '@web/lib/bank-customers/authenticate-bank-customer-request';

type Params = { spaceSlug: string; transferId: string };

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, transferId } = await params;
  const id = Number.parseInt(transferId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid transfer id' }, { status: 400 });
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
    const result = await activateSpaceBankTransfer(
      { spaceSlug, authToken, transferId: id },
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

    console.error('banking/transfers/activate POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to activate transfer' },
      { status: 500 },
    );
  }
}
