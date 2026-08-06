import { NextResponse } from 'next/server';
import { z } from 'zod';

import { appUrl, getPaymentProviderId } from '@rs/server/config';
import { signMockPayload } from '@rs/server/payments';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reference: z.string().min(1),
  amountCents: z.number().int().positive(),
  email: z.string().email().nullable().optional(),
});

/**
 * Simulates the provider calling us back, for the `mock` checkout only.
 *
 * It signs a payload and posts it to the real webhook endpoint over HTTP
 * rather than shortcutting to the handler, so what gets exercised in testing
 * is the same path Paddle or Stripe will take in production.
 */
export async function POST(request: Request) {
  return handle(async () => {
    if (getPaymentProviderId() !== 'mock') {
      return NextResponse.json(
        { error: 'Mock checkout is disabled' },
        { status: 404 },
      );
    }

    const body = bodySchema.parse(await readJson(request));
    const payload = JSON.stringify({
      type: 'payment.completed',
      reference: body.reference,
      amountCents: body.amountCents,
      email: body.email ?? null,
    });

    const response = await fetch(`${appUrl}/api/webhooks/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mock-signature': signMockPayload(payload),
      },
      body: payload,
    });

    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  });
}
