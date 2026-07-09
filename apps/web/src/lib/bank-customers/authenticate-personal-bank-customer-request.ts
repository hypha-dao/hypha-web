import {
  authorizePersonalBankOnboarding,
  findPersonBySlug,
  verifyPrivyAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import { extractBearerToken } from './authenticate-bank-customer-request';

type PersonRecord = NonNullable<Awaited<ReturnType<typeof findPersonBySlug>>>;

type AuthenticatePersonalBankCustomerResult =
  | { ok: true; person: PersonRecord; authToken: string }
  | { ok: false; response: NextResponse };

/**
 * Personal banking auth: verifies the Privy token, resolves the profile owner by
 * slug, and asserts the caller is that owner (no space membership/delegate check).
 */
export async function authenticatePersonalBankCustomerRequest(
  request: NextRequest,
  personSlug: string,
): Promise<AuthenticatePersonalBankCustomerResult> {
  try {
    const authToken = extractBearerToken(request);

    if (!authToken) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const auth = await verifyPrivyAuthToken(authToken);
    if (!auth.ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const person = await findPersonBySlug({ slug: personSlug }, { db });
    if (!person) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Person not found' },
          { status: 404 },
        ),
      };
    }

    const authorization = await authorizePersonalBankOnboarding({
      person: { id: person.id },
      authToken,
    });

    if (!authorization.authorized) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: authorization.message },
          { status: authorization.httpStatus },
        ),
      };
    }

    return { ok: true, person, authToken };
  } catch (error) {
    console.error('authenticatePersonalBankCustomerRequest failed:', error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 },
      ),
    };
  }
}
