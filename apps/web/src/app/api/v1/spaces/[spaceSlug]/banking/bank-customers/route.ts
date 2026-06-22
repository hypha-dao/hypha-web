import {
  BankOnboardingError,
  getSpaceBankCustomerPublicStatus,
  requestSpaceBankOnboarding,
  schemaSpaceBankCustomerOnboarding,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import {
  authenticateBankCustomerRequest,
  extractBearerToken,
} from '@web/lib/bank-customers/authenticate-bank-customer-request';
import { sendBankOnboardingEmail } from '@web/lib/bank-customers/send-onboarding-email';

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

    const status = await getSpaceBankCustomerPublicStatus(authResult.space, {
      db,
    });
    if (status === null) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error(
      'banking/bank-customers GET failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch bank customer status' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const authToken = extractBearerToken(request);
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schemaSpaceBankCustomerOnboarding.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { spaceSlug } = await params;
  const { legalName, contactEmail, requestedRails, endorsements } = parsed.data;

  try {
    const result = await requestSpaceBankOnboarding(
      {
        spaceSlug,
        authToken,
        legalName,
        contactEmail,
        requestedRails: requestedRails ?? endorsements,
      },
      { db },
    );

    if (result.created && result.kycLink) {
      await sendBankOnboardingEmail({
        recipientEmail: contactEmail,
        spaceTitle: result.spaceTitle,
        legalName,
        kycLink: result.kycLink,
        tosLink: result.tosLink,
      });
    }

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
      'banking/bank-customers onboarding failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to start bank customer onboarding' },
      { status: 500 },
    );
  }
}
