import {
  BankOnboardingError,
  simulateSpaceBankKycApproval,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import {
  authenticateBankCustomerRequest,
  extractBearerToken,
} from '@web/lib/bank-customers/authenticate-bank-customer-request';

type Params = { spaceSlug: string };

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  const authResult = await authenticateBankCustomerRequest(request, spaceSlug);
  if (!authResult.ok) {
    return authResult.response;
  }

  const authToken = extractBearerToken(request);
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await simulateSpaceBankKycApproval(
      { spaceSlug, authToken },
      { db },
    );

    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof BankOnboardingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error('banking/sandbox/simulate-kyc-approval failed:', error);
    return NextResponse.json(
      { error: 'Failed to simulate KYB approval' },
      { status: 500 },
    );
  }
}
