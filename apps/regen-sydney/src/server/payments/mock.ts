import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { appUrl } from '../config';
import type {
  CreateCheckoutInput,
  CheckoutSession,
  PaymentProvider,
  WebhookResult,
} from './provider';

/**
 * Stand-in provider used until Paddle or Stripe is chosen. It exercises the
 * real path end to end — checkout page, signed webhook, grant, mint — so the
 * only thing left to swap later is the adapter itself.
 *
 * It signs its own callbacks with the same HMAC scheme the real providers use,
 * which means the webhook route has no "if mock" branch in it.
 */

function secret(): string {
  return process.env.CAMPAIGN_MOCK_PAYMENT_SECRET || 'regen-sydney-mock-secret';
}

export function signMockPayload(body: string): string {
  return createHmac('sha256', secret()).update(body, 'utf8').digest('hex');
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock' as const;

  isConfigured(): boolean {
    return true;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const params = new URLSearchParams({
      reference: input.reference,
      amount: String(input.amountCents),
      email: input.email ?? '',
    });

    return {
      provider: this.id,
      reference: input.reference,
      url: `${appUrl}/checkout/mock?${params.toString()}`,
      clientToken: null,
      priceId: null,
    };
  }

  async handleWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookResult> {
    const signature = headers.get('x-mock-signature') ?? '';
    const expected = signMockPayload(rawBody);

    const given = Buffer.from(signature, 'utf8');
    const want = Buffer.from(expected, 'utf8');
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return { ok: false, reason: 'Bad signature' };
    }

    let payload: {
      type?: string;
      reference?: string;
      amountCents?: number;
      email?: string | null;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: 'Malformed JSON' };
    }

    if (payload.type !== 'payment.completed' || !payload.reference) {
      return { ok: true, event: null };
    }

    return {
      ok: true,
      event: {
        type: 'payment.completed',
        providerReference: payload.reference,
        reference: payload.reference,
        amountCents: Number(payload.amountCents ?? 0),
        currency: 'AUD',
        email: payload.email ?? null,
        occurredAt: new Date().toISOString(),
      },
    };
  }
}
