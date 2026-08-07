import 'server-only';

import type { PaymentProviderId } from '../config';

/**
 * Checkout is deliberately abstracted: Paddle and Stripe are both still on the
 * table. Everything downstream of a settled payment — the grant, the RSUT
 * mint, the tally — depends only on `PaymentEvent`, so switching providers is
 * a change of adapter and environment variables, not of business logic.
 */

export type CreateCheckoutInput = {
  amountCents: number;
  currency: 'AUD';
  /** Our own id for the payment, echoed back by the provider's webhook. */
  reference: string;
  memberId: number;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  provider: PaymentProviderId;
  reference: string;
  /** Redirect-style checkout (Stripe, mock). */
  url: string | null;
  /** Overlay-style checkout (Paddle.js opens this client-side). */
  clientToken: string | null;
  priceId: string | null;
};

export type PaymentEvent = {
  type: 'payment.completed' | 'payment.refunded';
  /** The provider's own id — used with the provider name as a unique pair. */
  providerReference: string;
  /** Our reference, round-tripped through the provider's metadata. */
  reference: string | null;
  amountCents: number;
  currency: string;
  email: string | null;
  occurredAt: string;
};

export type WebhookResult =
  | { ok: true; event: PaymentEvent | null }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /**
   * Sandbox or production, where the provider distinguishes them. Surfaced on
   * the admin screen so nobody has to guess whether a contribution was real.
   */
  readonly mode?: 'test' | 'live' | 'unknown';
  /** False when the provider is selected but its credentials are missing. */
  isConfigured(): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /**
   * Verifies the signature and parses the payload in one step — the raw body
   * is needed for the HMAC, so splitting them invites a verify-then-reparse bug.
   */
  handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}

export class PaymentProviderError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

export function newReference(memberId: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `rs_${memberId}_${Date.now().toString(36)}_${random}`;
}
