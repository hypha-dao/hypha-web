import { NextResponse } from 'next/server';

import { applyPaymentEvent } from '@rs/server/campaign/contributions';
import { getPaymentProvider } from '@rs/server/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Single settlement endpoint for whichever provider is configured. The
 * signature scheme differs per provider but the downstream effect does not:
 * verify, map to a `PaymentEvent`, record a grant, mirror it on-chain.
 *
 * The raw body is read as text because every provider signs the exact bytes.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  const rawBody = await request.text();

  let result;
  try {
    result = await provider.handleWebhook(rawBody, request.headers);
  } catch (error) {
    console.error(`[${provider.id}] webhook handler threw:`, error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }

  if (!result.ok) {
    console.warn(`[${provider.id}] webhook rejected: ${result.reason}`);
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  if (!result.event) {
    return NextResponse.json({ ignored: true });
  }

  try {
    const outcome = await applyPaymentEvent(result.event, provider.id);
    if (!outcome.handled) {
      // 200 on purpose: the signature was valid and there is nothing for the
      // provider to retry, so returning an error would only cause a redelivery
      // loop for an event we have deliberately declined.
      console.warn(`[${provider.id}] event not applied: ${outcome.reason}`);
      return NextResponse.json({ handled: false, reason: outcome.reason });
    }
    return NextResponse.json({ handled: true });
  } catch (error) {
    // A real failure — let the provider retry.
    console.error(`[${provider.id}] failed to apply event:`, error);
    return NextResponse.json(
      { error: 'Could not record payment' },
      { status: 500 },
    );
  }
}
