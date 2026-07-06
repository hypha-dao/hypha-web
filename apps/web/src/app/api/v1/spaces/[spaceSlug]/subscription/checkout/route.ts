import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createSubscriptionCheckoutSession } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authenticateSubscriptionRequest } from '@web/lib/subscriptions/authenticate-subscription-request';
import { buildSpaceUrl } from '@web/lib/subscriptions/build-space-url';

type Params = { spaceSlug: string };

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  lang: z.enum(['en', 'pt', 'es', 'fr', 'de']).default('en'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  const authResult = await authenticateSubscriptionRequest(request, spaceSlug);
  if (!authResult.ok) {
    return authResult.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const { space, person } = authResult;
  if (typeof space.web3SpaceId !== 'number') {
    return NextResponse.json(
      { error: 'Space is not deployed on-chain yet' },
      { status: 409 },
    );
  }

  try {
    const spaceUrl = buildSpaceUrl(parsed.data.lang, spaceSlug);
    const result = await createSubscriptionCheckoutSession(
      {
        space: {
          id: space.id,
          slug: space.slug,
          web3SpaceId: space.web3SpaceId,
        },
        person: {
          id: person.id,
          email: person.email,
          name: person.name,
        },
        successUrl: `${spaceUrl}?subscription=success`,
        cancelUrl: `${spaceUrl}?subscription=cancelled`,
      },
      { db },
    );

    return NextResponse.json(
      { checkoutUrl: result.checkoutUrl },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      'subscription/checkout POST failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
