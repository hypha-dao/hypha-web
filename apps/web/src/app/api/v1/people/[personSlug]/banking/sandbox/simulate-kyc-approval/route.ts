import {
  BankOnboardingError,
  simulatePersonalBankKycApproval,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import { authenticatePersonalBankCustomerRequest } from '@web/lib/bank-customers/authenticate-personal-bank-customer-request';

type Params = { personSlug: string };

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { personSlug } = await params;

  const authResult = await authenticatePersonalBankCustomerRequest(
    request,
    personSlug,
  );
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const status = await simulatePersonalBankKycApproval(
      { personSlug, authToken: authResult.authToken },
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

    console.error(
      'people/banking/sandbox/simulate-kyc-approval failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to simulate KYC approval' },
      { status: 500 },
    );
  }
}
