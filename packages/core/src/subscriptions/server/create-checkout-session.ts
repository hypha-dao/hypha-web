import 'server-only';

import type { DbConfig } from '../../common/server/types';
import { getStripeClient, getStripeSpaceMonthlyPriceId } from './stripe-client';
import {
  findPersonStripeCustomerByPersonId,
  findSpaceSubscriptionBySpaceAndPerson,
} from './queries';
import {
  insertPersonStripeCustomerIfNew,
  insertSpaceSubscription,
  updateSpaceSubscription,
} from './mutations';

export type CreateSubscriptionCheckoutSessionInput = {
  space: {
    id: number;
    slug: string;
    title: string;
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
 * One Stripe Customer per person, shared across all of their space
 * subscriptions, so the Billing Portal lists every subscription together.
 * Concurrent checkouts may both create a Stripe customer; the unique
 * person_id constraint picks one winner and the loser is re-read (the
 * orphaned Stripe customer is harmless and never referenced).
 */
async function getOrCreatePersonStripeCustomerId(
  person: CreateSubscriptionCheckoutSessionInput['person'],
  { db }: DbConfig,
): Promise<string> {
  const existing = await findPersonStripeCustomerByPersonId(
    { personId: person.id },
    { db },
  );
  if (existing) return existing.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: person.email ?? undefined,
    name: person.name ?? undefined,
    metadata: { personId: String(person.id) },
  });

  const inserted = await insertPersonStripeCustomerIfNew(
    { personId: person.id, stripeCustomerId: customer.id },
    { db },
  );
  if (inserted) return inserted.stripeCustomerId;

  const winner = await findPersonStripeCustomerByPersonId(
    { personId: person.id },
    { db },
  );
  if (!winner) {
    throw new Error(
      `Failed to persist Stripe customer for person ${person.id}`,
    );
  }
  return winner.stripeCustomerId;
}

/**
 * Reuses (or creates) the person's shared Stripe Customer and opens a
 * subscription-mode Checkout Session for the monthly space price. The DB row
 * id travels in metadata so the webhook can link the resulting Stripe
 * subscription back to the space; the description tells subscriptions for
 * different spaces apart inside the Billing Portal.
 */
export async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionCheckoutSessionInput,
  { db }: DbConfig,
): Promise<CreateSubscriptionCheckoutSessionResult> {
  const stripe = getStripeClient();

  const stripeCustomerId = await getOrCreatePersonStripeCustomerId(
    input.person,
    { db },
  );

  let subscription = await findSpaceSubscriptionBySpaceAndPerson(
    { spaceId: input.space.id, personId: input.person.id },
    { db },
  );

  if (!subscription) {
    subscription = await insertSpaceSubscription(
      {
        spaceId: input.space.id,
        personId: input.person.id,
        stripeCustomerId,
      },
      { db },
    );
  } else if (subscription.stripeCustomerId !== stripeCustomerId) {
    // Legacy row from the per-(space, person) customer era: move it onto the
    // shared customer so the new checkout and the portal agree.
    subscription = await updateSpaceSubscription(
      { id: subscription.id, stripeCustomerId },
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
    customer: stripeCustomerId,
    line_items: [{ price: getStripeSpaceMonthlyPriceId(), quantity: 1 }],
    metadata,
    subscription_data: {
      metadata,
      description: `Hypha space subscription — ${input.space.title}`,
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout Session URL');
  }

  return { checkoutUrl: session.url, spaceSubscriptionId: subscription.id };
}
