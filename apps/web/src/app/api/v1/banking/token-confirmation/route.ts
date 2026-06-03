import {
  BankOnboardingError,
  validateAndConfirmBankEmail,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import { sendBankOnboardingEmail } from '@web/lib/bank-customers/send-onboarding-email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token =
    typeof body === 'object' &&
    body !== null &&
    'token' in body &&
    typeof (body as { token: unknown }).token === 'string'
      ? (body as { token: string }).token
      : null;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const result = await validateAndConfirmBankEmail(token, { db });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: 400 },
      );
    }

    if (result.result.kycLink) {
      await sendBankOnboardingEmail({
        recipientEmail: result.providerCustomerEmail,
        spaceTitle: result.result.spaceTitle,
        legalName: result.legalName,
        kycLink: result.result.kycLink,
        tosLink: result.result.tosLink,
      });
    }

    return NextResponse.json({
      ok: true,
      spaceSlug: result.spaceSlug,
    });
  } catch (error) {
    if (error instanceof BankOnboardingError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }

    console.error(
      'banking/token-confirmation failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: 'Failed to confirm email' },
      { status: 500 },
    );
  }
}
