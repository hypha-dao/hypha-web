import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { paddleConfig } from '../config';
import {
  PaymentProviderError,
  type CreateCheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type WebhookResult,
} from './provider';

/**
 * Paddle Billing adapter.
 *
 * A transaction is created server-side with a custom unit price so arbitrary
 * donation amounts work, then Paddle.js opens the overlay with the returned
 * transaction id. Settlement arrives on `transaction.completed`.
 *
 * Unresolved before this can go live: Paddle is a Merchant of Record, so the
 * donor gets a Paddle purchase receipt rather than a deductible donation
 * receipt from Regen Sydney Ltd. That is a DGR question, not a code one.
 */
export class PaddlePaymentProvider implements PaymentProvider {
  readonly id = 'paddle' as const;

  isConfigured(): boolean {
    return Boolean(paddleConfig.apiKey && paddleConfig.webhookSecret);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new PaymentProviderError(
        503,
        'Paddle is selected but PADDLE_API_KEY / PADDLE_WEBHOOK_SECRET are not set',
      );
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    this.assertConfigured();

    const item = paddleConfig.priceId
      ? { price_id: paddleConfig.priceId, quantity: 1 }
      : {
          quantity: 1,
          price: {
            description: 'Regen Sydney community fund contribution',
            name: 'Contribution',
            unit_price: {
              amount: String(input.amountCents),
              currency_code: input.currency,
            },
            product: {
              name: 'Regen Sydney community fund',
              tax_category: 'standard',
            },
          },
        };

    const response = await fetch(`${paddleConfig.apiBase}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paddleConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [item],
        currency_code: input.currency,
        collection_mode: 'automatic',
        custom_data: { reference: input.reference, memberId: input.memberId },
        ...(input.email ? { customer: { email: input.email } } : {}),
        checkout: { url: input.successUrl },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new PaymentProviderError(
        502,
        `Paddle rejected the transaction: ${detail.slice(0, 300)}`,
      );
    }

    const body = (await response.json()) as {
      data?: { id?: string; checkout?: { url?: string } };
    };
    const transactionId = body.data?.id;
    if (!transactionId) {
      throw new PaymentProviderError(502, 'Paddle returned no transaction id');
    }

    return {
      provider: this.id,
      reference: input.reference,
      url: body.data?.checkout?.url ?? null,
      clientToken: transactionId,
      priceId: paddleConfig.priceId || null,
    };
  }

  async handleWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookResult> {
    if (!this.isConfigured()) {
      return { ok: false, reason: 'Paddle webhook secret is not configured' };
    }

    // Paddle-Signature: ts=1234567890;h1=<hmac of "ts:rawBody">
    const header = headers.get('paddle-signature') ?? '';
    const parts = Object.fromEntries(
      header
        .split(';')
        .map((chunk) => chunk.split('='))
        .filter((pair): pair is [string, string] => pair.length === 2),
    );

    const timestamp = parts.ts;
    const signature = parts.h1;
    if (!timestamp || !signature) {
      return { ok: false, reason: 'Missing Paddle-Signature header' };
    }

    const expected = createHmac('sha256', paddleConfig.webhookSecret)
      .update(`${timestamp}:${rawBody}`, 'utf8')
      .digest('hex');

    const given = Buffer.from(signature, 'utf8');
    const want = Buffer.from(expected, 'utf8');
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return { ok: false, reason: 'Bad signature' };
    }

    let payload: PaddleEvent;
    try {
      payload = JSON.parse(rawBody) as PaddleEvent;
    } catch {
      return { ok: false, reason: 'Malformed JSON' };
    }

    const type =
      payload.event_type === 'transaction.completed'
        ? ('payment.completed' as const)
        : payload.event_type === 'adjustment.updated'
        ? ('payment.refunded' as const)
        : null;

    if (!type || !payload.data?.id) return { ok: true, event: null };

    const totalCents = Number(payload.data.details?.totals?.total ?? 0);

    return {
      ok: true,
      event: {
        type,
        providerReference: payload.data.id,
        reference: payload.data.custom_data?.reference ?? null,
        amountCents: Number.isFinite(totalCents) ? totalCents : 0,
        currency: payload.data.currency_code ?? 'AUD',
        email: payload.data.customer?.email ?? null,
        occurredAt: payload.occurred_at ?? new Date().toISOString(),
      },
    };
  }
}

type PaddleEvent = {
  event_type?: string;
  occurred_at?: string;
  data?: {
    id?: string;
    currency_code?: string;
    custom_data?: { reference?: string };
    customer?: { email?: string };
    details?: { totals?: { total?: string } };
  };
};
