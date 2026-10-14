import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { CheckoutSessionDto } from '@rs/lib/campaign-types';
import { requireViewer } from '@rs/server/auth';
import { appUrl, campaignConfig } from '@rs/server/config';
import { getPaymentProvider, newReference } from '@rs/server/payments';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  amountAud: z.number().positive(),
});

/**
 * Opens a checkout with whichever provider is configured. Nothing is granted
 * here — voting power only appears once the provider's webhook confirms the
 * money actually settled.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer(request);
    const { amountAud } = bodySchema.parse(await readJson(request));

    if (
      amountAud < campaignConfig.minContributionAud ||
      amountAud > campaignConfig.maxContributionAud
    ) {
      return NextResponse.json(
        {
          error: `Contributions must be between A$${campaignConfig.minContributionAud} and A$${campaignConfig.maxContributionAud}`,
        },
        { status: 400 },
      );
    }

    const provider = getPaymentProvider();
    const reference = newReference(viewer.member.id);

    const session = await provider.createCheckout({
      amountCents: Math.round(amountAud * 100),
      currency: 'AUD',
      reference,
      memberId: viewer.member.id,
      email: viewer.member.email,
      successUrl: `${appUrl}/?contributed=1`,
      cancelUrl: `${appUrl}/?contributed=0`,
    });

    const dto: CheckoutSessionDto = {
      provider: session.provider,
      reference: session.reference,
      url: session.url,
      clientToken: session.clientToken,
      priceId: session.priceId,
      amountAud,
    };
    return NextResponse.json(dto);
  });
}
