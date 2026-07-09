import {
  BankOnboardingError,
  getPersonalBankCustomerPublicStatus,
  requestPersonalBankOnboarding,
  schemaSpaceBankCustomerOnboarding,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import { authenticatePersonalBankCustomerRequest } from '@web/lib/bank-customers/authenticate-personal-bank-customer-request';
import { sendBankOnboardingEmail } from '@web/lib/bank-customers/send-onboarding-email';

type Params = { personSlug: string };

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { personSlug } = await params;

  try {
    const authResult = await authenticatePersonalBankCustomerRequest(
      request,
      personSlug,
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    const status = await getPersonalBankCustomerPublicStatus(
      authResult.person,
      { db },
    );
    if (status === null) {
      return NextResponse.json(null, {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error(
      'people/banking/bank-customers GET failed:',
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
  const { personSlug } = await params;

  const authResult = await authenticatePersonalBankCustomerRequest(
    request,
    personSlug,
  );
  if (!authResult.ok) {
    return authResult.response;
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

  const { legalName, contactEmail, requestedRails, endorsements } = parsed.data;

  try {
    const result = await requestPersonalBankOnboarding(
      {
        personSlug,
        authToken: authResult.authToken,
        legalName,
        contactEmail,
        requestedRails: requestedRails ?? endorsements,
      },
      { db },
    );

    if (result.created && result.kycLink) {
      await sendBankOnboardingEmail({
        recipientEmail: contactEmail,
        spaceTitle: result.ownerName,
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
      'people/banking/bank-customers onboarding failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to start bank customer onboarding' },
      { status: 500 },
    );
  }
}
