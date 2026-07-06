import 'server-only';

import type { DbConfig } from '../../common/server/types';
import { getStripeClient } from './stripe-client';
import { findSpaceSubscriptionBySpaceAndPerson } from './queries';

export type CreatePortalSessionInput = {
  spaceId: number;
  personId: number;
  returnUrl: string;
};

export type CreatePortalSessionResult = {
  portalUrl: string;
};

/**
 * Opens a Stripe Customer Portal session so the payer can manage their card,
 * see invoices or cancel the subscription. Only the person who created the
 * subscription owns the Stripe Customer, so lookup is scoped to (space, payer).
 */
export async function createSubscriptionPortalSession(
  input: CreatePortalSessionInput,
  { db }: DbConfig,
): Promise<CreatePortalSessionResult> {
  const subscription = await findSpaceSubscriptionBySpaceAndPerson(
    { spaceId: input.spaceId, personId: input.personId },
    { db },
  );

  if (!subscription) {
    throw new Error('No subscription found for this space and person');
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: input.returnUrl,
  });

  return { portalUrl: session.url };
}
