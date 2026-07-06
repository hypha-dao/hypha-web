import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createSubscriptionPortalSession } from '@hypha-platform/core/server';
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

  try {
    const result = await createSubscriptionPortalSession(
      {
        spaceId: authResult.space.id,
        personId: authResult.person.id,
        returnUrl: buildSpaceUrl(parsed.data.lang, spaceSlug),
      },
      { db },
    );

    return NextResponse.json(
      { portalUrl: result.portalUrl },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      'subscription/portal POST failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 },
    );
  }
}
