import 'server-only';

import Stripe from 'stripe';

let cachedClient: Stripe | null = null;

/**
 * Server-only Stripe client. Uses the SDK's pinned API version.
 * Prefer a restricted key (rk_...) scoped to Customers, Checkout Sessions,
 * Billing Portal, Subscriptions and Invoices.
 */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  cachedClient = new Stripe(apiKey);
  return cachedClient;
}

export function getStripeSpaceMonthlyPriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID_SPACE_MONTHLY;
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID_SPACE_MONTHLY is not set');
  }
  return priceId;
}
