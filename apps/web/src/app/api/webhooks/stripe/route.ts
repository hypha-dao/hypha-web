import { NextRequest, NextResponse } from 'next/server';

import {
  getStripeClient,
  processStripeWebhookEvent,
  settleSpaceSubscriptionOnchain,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export const dynamic = 'force-dynamic';

/**
 * Stripe Billing webhook: converts paid invoices into on-chain subscription
 * days via the platform hot wallet. Signature-verified with the endpoint
 * secret; duplicate deliveries are idempotent (unique stripe_invoice_id).
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('stripe webhook: STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook is not configured' },
      { status: 500 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const rawBody = await request.text();

  const event = await getStripeClient()
    .webhooks.constructEventAsync(rawBody, signature, webhookSecret)
    .catch((error: unknown) => {
      console.warn(
        'stripe webhook: signature verification failed:',
        error instanceof Error ? error.message : error,
      );
      return null;
    });

  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const result = await processStripeWebhookEvent(event, {
      db,
      settleSpaceSubscription: settleSpaceSubscriptionOnchain,
    });

    console.log(`stripe webhook: ${event.type} — ${result.detail}`);
    return NextResponse.json({ received: true, detail: result.detail });
  } catch (error) {
    console.error(
      `stripe webhook: processing ${event.type} failed:`,
      error instanceof Error ? error.message : error,
    );
    // Non-2xx makes Stripe retry the delivery — safe due to idempotency.
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
