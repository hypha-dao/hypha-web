import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createSubscriptionsPortalSession } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authenticatePersonRequest } from '@web/lib/subscriptions/authenticate-subscription-request';
import { buildMySpacesUrl } from '@web/lib/subscriptions/build-space-url';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  lang: z.enum(['en', 'pt', 'es', 'fr', 'de']).default('en'),
});

/**
 * Opens the Stripe Customer Portal for the caller. The portal lists every
 * space subscription under the person's shared Stripe customer.
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticatePersonRequest(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  try {
    const result = await createSubscriptionsPortalSession(
      {
        personId: authResult.person.id,
        returnUrl: buildMySpacesUrl(parsed.data.lang),
      },
      { db },
    );

    return NextResponse.json(
      { portalUrl: result.portalUrl },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      'me/subscriptions/portal POST failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 },
    );
  }
}
