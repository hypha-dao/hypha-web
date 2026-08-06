import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { stripeConfig } from '../config';
import {
  PaymentProviderError,
  type CreateCheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type WebhookResult,
} from './provider';

/**
 * Stripe Checkout adapter, written against the REST API directly so the app
 * carries no SDK for a provider that may not be chosen.
 *
 * Unlike Paddle, Stripe is not a Merchant of Record: Regen Sydney Ltd remains
 * the seller of record, which is the simpler position for DGR receipting.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly id = 'stripe' as const;

  isConfigured(): boolean {
    return Boolean(stripeConfig.secretKey && stripeConfig.webhookSecret);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new PaymentProviderError(
        503,
        'Stripe is selected but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set',
      );
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    this.assertConfigured();

    const form = new URLSearchParams({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.reference,
      'metadata[reference]': input.reference,
      'metadata[personId]': String(input.personId),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(input.amountCents),
      'line_items[0][price_data][product_data][name]':
        'Regen Sydney community fund contribution',
    });
    if (input.email) form.set('customer_email', input.email);

    const response = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeConfig.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new PaymentProviderError(
        502,
        `Stripe rejected the session: ${detail.slice(0, 300)}`,
      );
    }

    const session = (await response.json()) as { id?: string; url?: string };
    if (!session.url) {
      throw new PaymentProviderError(502, 'Stripe returned no checkout url');
    }

    return {
      provider: this.id,
      reference: input.reference,
      url: session.url,
      clientToken: session.id ?? null,
      priceId: null,
    };
  }

  async handleWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookResult> {
    if (!this.isConfigured()) {
      return { ok: false, reason: 'Stripe webhook secret is not configured' };
    }

    // Stripe-Signature: t=1234567890,v1=<hmac of "t.rawBody">
    const header = headers.get('stripe-signature') ?? '';
    const parts = Object.fromEntries(
      header
        .split(',')
        .map((chunk) => chunk.split('='))
        .filter((pair): pair is [string, string] => pair.length === 2),
    );

    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) {
      return { ok: false, reason: 'Missing Stripe-Signature header' };
    }

    const expected = createHmac('sha256', stripeConfig.webhookSecret)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');

    const given = Buffer.from(signature, 'utf8');
    const want = Buffer.from(expected, 'utf8');
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return { ok: false, reason: 'Bad signature' };
    }

    let payload: StripeEvent;
    try {
      payload = JSON.parse(rawBody) as StripeEvent;
    } catch {
      return { ok: false, reason: 'Malformed JSON' };
    }

    const type =
      payload.type === 'checkout.session.completed'
        ? ('payment.completed' as const)
        : payload.type === 'charge.refunded'
        ? ('payment.refunded' as const)
        : null;

    const object = payload.data?.object;
    if (!type || !object?.id) return { ok: true, event: null };

    return {
      ok: true,
      event: {
        type,
        providerReference: object.id,
        reference:
          object.metadata?.reference ?? object.client_reference_id ?? null,
        amountCents: Number(object.amount_total ?? object.amount ?? 0),
        currency: (object.currency ?? 'aud').toUpperCase(),
        email: object.customer_email ?? object.customer_details?.email ?? null,
        occurredAt: new Date((payload.created ?? 0) * 1000).toISOString(),
      },
    };
  }
}

type StripeEvent = {
  type?: string;
  created?: number;
  data?: {
    object?: {
      id?: string;
      amount?: number;
      amount_total?: number;
      currency?: string;
      client_reference_id?: string;
      customer_email?: string;
      customer_details?: { email?: string };
      metadata?: { reference?: string };
    };
  };
};
