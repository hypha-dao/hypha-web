import 'server-only';

import type { DbConfig } from '../../common/server/types';
import { getStripeClient } from './stripe-client';
import {
  findLatestSpaceSubscriptionByPersonId,
  findPersonStripeCustomerByPersonId,
} from './queries';

export type CreatePortalSessionInput = {
  personId: number;
  returnUrl: string;
};

export type CreatePortalSessionResult = {
  portalUrl: string;
};

/**
 * Opens a Stripe Customer Portal session for the person's shared Stripe
 * Customer. Every space subscription the person pays for lives under that
 * one customer, so the portal lists them all — the payer can update their
 * card, see invoices or cancel each subscription individually.
 */
export async function createSubscriptionsPortalSession(
  input: CreatePortalSessionInput,
  { db }: DbConfig,
): Promise<CreatePortalSessionResult> {
  const customer = await findPersonStripeCustomerByPersonId(
    { personId: input.personId },
    { db },
  );

  // Legacy fallback: subscriptions created before the shared-customer model
  // have their (per-space) customer only on the subscription row.
  let stripeCustomerId = customer?.stripeCustomerId;
  if (!stripeCustomerId) {
    const legacy = await findLatestSpaceSubscriptionByPersonId(
      { personId: input.personId },
      { db },
    );
    stripeCustomerId = legacy?.stripeCustomerId;
  }

  if (!stripeCustomerId) {
    throw new Error(`No Stripe customer found for person ${input.personId}`);
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: input.returnUrl,
  });

  return { portalUrl: session.url };
}
