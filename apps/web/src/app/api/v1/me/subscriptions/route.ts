import { NextRequest, NextResponse } from 'next/server';

import { findSpaceSubscriptionsByPersonId } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authenticatePersonRequest } from '@web/lib/subscriptions/authenticate-subscription-request';

export const dynamic = 'force-dynamic';

/** All card (Stripe) space subscriptions the caller pays for. */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticatePersonRequest(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const subscriptions = await findSpaceSubscriptionsByPersonId(
      { personId: authResult.person.id },
      { db },
    );

    return NextResponse.json(
      {
        hasSubscriptions: subscriptions.length > 0,
        subscriptions,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      'me/subscriptions GET failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 },
    );
  }
}
