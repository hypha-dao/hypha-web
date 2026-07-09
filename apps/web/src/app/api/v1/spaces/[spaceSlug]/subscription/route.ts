import { NextRequest, NextResponse } from 'next/server';

import {
  findSpaceSubscriptionBySpaceAndPerson,
  findSpaceSubscriptionsBySpaceId,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authenticateSubscriptionRequest } from '@web/lib/subscriptions/authenticate-subscription-request';

type Params = { spaceSlug: string };

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const authResult = await authenticateSubscriptionRequest(
      request,
      spaceSlug,
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    const [subscriptions, mySubscription] = await Promise.all([
      findSpaceSubscriptionsBySpaceId({ spaceId: authResult.space.id }, { db }),
      findSpaceSubscriptionBySpaceAndPerson(
        { spaceId: authResult.space.id, personId: authResult.person.id },
        { db },
      ),
    ]);

    return NextResponse.json(
      {
        hasActiveSubscription: subscriptions.some(
          (subscription) => subscription.status === 'active',
        ),
        mySubscription: mySubscription
          ? {
              id: mySubscription.id,
              status: mySubscription.status,
              createdAt: mySubscription.createdAt,
            }
          : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      'subscription GET failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 },
    );
  }
}
