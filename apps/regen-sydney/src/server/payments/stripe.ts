import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { stripeConfig } from '../config';
import {
  PaymentProviderError,
  type CreateCheckoutInput,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type WebhookResult,
} from './provider';

/** Stripe rejects events older than this to blunt replay attempts. */
const SIGNATURE_TOLERANCE_SECONDS = 60 * 5;

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

  /**
   * `sk_` is a full secret key, `rk_` a restricted one — the campaign only
   * needs permission to create Checkout Sessions, so a restricted key is the
   * better thing to deploy. Either carries `test` or `live` in the middle.
   */
  get mode(): 'test' | 'live' | 'unknown' {
    if (/^(sk|rk)_test_/.test(stripeConfig.secretKey)) return 'test';
    if (/^(sk|rk)_live_/.test(stripeConfig.secretKey)) return 'live';
    return 'unknown';
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
      'metadata[memberId]': String(input.memberId),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(input.amountCents),
      'line_items[0][price_data][product_data][name]':
        'Regen Sydney community fund contribution',
      // Carried onto the PaymentIntent and charge, so a refund or a dashboard
      // lookup can still be traced back to the contributor.
      'payment_intent_data[metadata][reference]': input.reference,
      'payment_intent_data[metadata][memberId]': String(input.memberId),
      submit_type: 'donate',
    });
    if (input.email) form.set('customer_email', input.email);

    const response = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeConfig.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          // Our reference is generated per checkout attempt, so a retried
          // request reuses the session Stripe already made rather than opening
          // a second one against the same contribution.
          'Idempotency-Key': input.reference,
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

    // Stripe-Signature: t=1234567890,v1=<hmac of "t.rawBody">[,v1=<another>]
    // A second v1 appears while a signing secret is being rotated, so collect
    // every candidate rather than keeping the last one.
    const header = headers.get('stripe-signature') ?? '';
    let timestamp = '';
    const signatures: string[] = [];
    for (const chunk of header.split(',')) {
      const separator = chunk.indexOf('=');
      if (separator === -1) continue;
      const key = chunk.slice(0, separator).trim();
      const value = chunk.slice(separator + 1).trim();
      if (key === 't') timestamp = value;
      else if (key === 'v1') signatures.push(value);
    }

    if (!timestamp || signatures.length === 0) {
      return { ok: false, reason: 'Missing Stripe-Signature header' };
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) {
      return { ok: false, reason: 'Signature timestamp outside tolerance' };
    }

    const expected = createHmac('sha256', stripeConfig.webhookSecret)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');
    const want = Buffer.from(expected, 'utf8');

    const matches = signatures.some((candidate) => {
      const given = Buffer.from(candidate, 'utf8');
      return given.length === want.length && timingSafeEqual(given, want);
    });
    if (!matches) return { ok: false, reason: 'Bad signature' };

    let payload: StripeEvent;
    try {
      payload = JSON.parse(rawBody) as StripeEvent;
    } catch {
      return { ok: false, reason: 'Malformed JSON' };
    }

    const object = payload.data?.object;
    if (!object?.id) return { ok: true, event: null };

    // `checkout.session.completed` fires as soon as the customer finishes the
    // form, which for delayed methods (BECS direct debit, bank transfer) is
    // before the money arrives. Granting RSUT then would hand out voting power
    // for a payment that can still fail, so an unpaid session is left for the
    // async_payment_succeeded event that follows it.
    let type: PaymentEvent['type'] | null = null;
    if (payload.type === 'checkout.session.completed') {
      if (object.payment_status !== 'paid') {
        return { ok: true, event: null };
      }
      type = 'payment.completed';
    } else if (payload.type === 'checkout.session.async_payment_succeeded') {
      type = 'payment.completed';
    } else if (payload.type === 'charge.refunded') {
      type = 'payment.refunded';
    }

    if (!type) return { ok: true, event: null };

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
      payment_status?: string;
      client_reference_id?: string;
      customer_email?: string;
      customer_details?: { email?: string };
      metadata?: { reference?: string };
    };
  };
};
