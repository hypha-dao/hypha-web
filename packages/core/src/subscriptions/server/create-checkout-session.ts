import 'server-only';

import type { DbConfig } from '../../common/server/types';
import { getStripeClient, getStripeSpaceMonthlyPriceId } from './stripe-client';
import { findSpaceSubscriptionBySpaceAndPerson } from './queries';
import { insertSpaceSubscription } from './mutations';

export type CreateSubscriptionCheckoutSessionInput = {
  space: {
    id: number;
    slug: string;
    web3SpaceId: number;
  };
  person: {
    id: number;
    email?: string | null;
    name?: string | null;
  };
  successUrl: string;
  cancelUrl: string;
};

export type CreateSubscriptionCheckoutSessionResult = {
  checkoutUrl: string;
  spaceSubscriptionId: number;
};

/**
 * Creates (or reuses) the Stripe Customer for this (space, payer) pair and
 * opens a subscription-mode Checkout Session for the monthly space price.
 * The DB row id travels in metadata so the webhook can link the resulting
 * Stripe subscription back to the space.
 */
export async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionCheckoutSessionInput,
  { db }: DbConfig,
): Promise<CreateSubscriptionCheckoutSessionResult> {
  const stripe = getStripeClient();

  let subscription = await findSpaceSubscriptionBySpaceAndPerson(
    { spaceId: input.space.id, personId: input.person.id },
    { db },
  );

  if (!subscription) {
    const customer = await stripe.customers.create({
      email: input.person.email ?? undefined,
      name: input.person.name ?? undefined,
      metadata: {
        spaceId: String(input.space.id),
        spaceSlug: input.space.slug,
        web3SpaceId: String(input.space.web3SpaceId),
        personId: String(input.person.id),
      },
    });

    subscription = await insertSpaceSubscription(
      {
        spaceId: input.space.id,
        personId: input.person.id,
        stripeCustomerId: customer.id,
      },
      { db },
    );
  }

  const metadata = {
    spaceSubscriptionId: String(subscription.id),
    spaceId: String(input.space.id),
    spaceSlug: input.space.slug,
    web3SpaceId: String(input.space.web3SpaceId),
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: subscription.stripeCustomerId,
    line_items: [{ price: getStripeSpaceMonthlyPriceId(), quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout Session URL');
  }

  return { checkoutUrl: session.url, spaceSubscriptionId: subscription.id };
}
