import 'server-only';

import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';

import { spaces } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { SUBSCRIPTION_USDC_PER_CYCLE } from '../constants';
import {
  findSpaceSubscriptionByStripeCustomerId,
  findSpaceSubscriptionByStripeSubscriptionId,
  findSubscriptionInvoiceByStripeInvoiceId,
} from './queries';
import {
  claimFailedInvoiceForRetry,
  insertSubscriptionInvoiceIfNew,
  updateSpaceSubscription,
  updateSubscriptionInvoiceSettlement,
} from './mutations';
import type { SettleSpaceSubscriptionFn } from './settle-invoice-onchain';

export type ProcessStripeWebhookEventResult = {
  handled: boolean;
  detail: string;
};

type ProcessConfig = DbConfig & {
  settleSpaceSubscription: SettleSpaceSubscriptionFn;
};

function asId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return asId(invoice.parent?.subscription_details?.subscription);
}

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): 'incomplete' | 'active' | 'past_due' | 'canceled' {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'incomplete';
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  { db }: DbConfig,
): Promise<ProcessStripeWebhookEventResult> {
  const rowId = Number(session.metadata?.spaceSubscriptionId);
  const stripeSubscriptionId = asId(session.subscription);

  if (!Number.isInteger(rowId) || rowId <= 0 || !stripeSubscriptionId) {
    return {
      handled: false,
      detail:
        'checkout.session.completed missing spaceSubscriptionId metadata or subscription',
    };
  }

  await updateSpaceSubscription({ id: rowId, stripeSubscriptionId }, { db });

  return {
    handled: true,
    detail: `linked subscription ${stripeSubscriptionId} to space_subscriptions ${rowId}`,
  };
}

async function resolveSubscriptionRow(
  invoice: Stripe.Invoice,
  { db }: DbConfig,
) {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  if (stripeSubscriptionId) {
    const row = await findSpaceSubscriptionByStripeSubscriptionId(
      { stripeSubscriptionId },
      { db },
    );
    if (row) return row;
  }

  // checkout.session.completed may not have arrived yet — fall back to the
  // customer created before checkout.
  const stripeCustomerId = asId(invoice.customer);
  if (!stripeCustomerId) return null;
  const row = await findSpaceSubscriptionByStripeCustomerId(
    { stripeCustomerId },
    { db },
  );
  if (row && !row.stripeSubscriptionId && stripeSubscriptionId) {
    return updateSpaceSubscription(
      { id: row.id, stripeSubscriptionId },
      { db },
    );
  }
  return row;
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  { db, settleSpaceSubscription }: ProcessConfig,
): Promise<ProcessStripeWebhookEventResult> {
  if (!invoice.id) {
    return { handled: false, detail: 'invoice.paid event has no invoice id' };
  }

  const subscriptionRow = await resolveSubscriptionRow(invoice, { db });
  if (!subscriptionRow) {
    return {
      handled: false,
      detail: `no space subscription found for invoice ${invoice.id}`,
    };
  }

  await updateSpaceSubscription(
    { id: subscriptionRow.id, status: 'active' },
    { db },
  );

  const amountUsdc = SUBSCRIPTION_USDC_PER_CYCLE;
  let invoiceRow = await insertSubscriptionInvoiceIfNew(
    {
      spaceSubscriptionId: subscriptionRow.id,
      stripeInvoiceId: invoice.id,
      amountUsdc: amountUsdc.toString(),
    },
    { db },
  );

  if (!invoiceRow) {
    // Redelivery of a known invoice: retry settlement only when the previous
    // attempt failed. The claim is an atomic failed→pending flip so
    // concurrent deliveries cannot double-settle.
    const existing = await findSubscriptionInvoiceByStripeInvoiceId(
      { stripeInvoiceId: invoice.id },
      { db },
    );
    if (existing?.settlementStatus === 'failed') {
      invoiceRow = await claimFailedInvoiceForRetry(
        { id: existing.id },
        { db },
      );
    }
    if (!invoiceRow) {
      return {
        handled: true,
        detail: `invoice ${invoice.id} already recorded; skipping settlement`,
      };
    }
  }

  const [space] = await db
    .select({ web3SpaceId: spaces.web3SpaceId })
    .from(spaces)
    .where(eq(spaces.id, subscriptionRow.spaceId))
    .limit(1);

  if (typeof space?.web3SpaceId !== 'number') {
    await updateSubscriptionInvoiceSettlement(
      {
        id: invoiceRow.id,
        settlementStatus: 'failed',
        settlementError: `space ${subscriptionRow.spaceId} has no web3SpaceId`,
      },
      { db },
    );
    return {
      handled: true,
      detail: `invoice ${invoice.id} recorded but space has no web3SpaceId`,
    };
  }

  const settlement = await settleSpaceSubscription({
    web3SpaceId: space.web3SpaceId,
    amountUsdc,
  });

  if (settlement.ok) {
    await updateSubscriptionInvoiceSettlement(
      {
        id: invoiceRow.id,
        settlementStatus: 'settled',
        txHash: settlement.txHash,
      },
      { db },
    );
    return {
      handled: true,
      detail: `invoice ${invoice.id} settled on-chain: ${settlement.txHash}`,
    };
  }

  await updateSubscriptionInvoiceSettlement(
    {
      id: invoiceRow.id,
      settlementStatus: 'failed',
      settlementError: settlement.error,
    },
    { db },
  );
  return {
    handled: true,
    detail: `invoice ${invoice.id} recorded but settlement failed: ${settlement.error}`,
  };
}

async function handleSubscriptionChanged(
  subscription: Stripe.Subscription,
  { db }: DbConfig,
): Promise<ProcessStripeWebhookEventResult> {
  const row = await findSpaceSubscriptionByStripeSubscriptionId(
    { stripeSubscriptionId: subscription.id },
    { db },
  );

  if (!row) {
    return {
      handled: false,
      detail: `no space subscription found for stripe subscription ${subscription.id}`,
    };
  }

  const status = mapStripeSubscriptionStatus(subscription.status);
  await updateSpaceSubscription({ id: row.id, status }, { db });

  return {
    handled: true,
    detail: `subscription ${subscription.id} status set to ${status}`,
  };
}

/**
 * Dispatches a verified Stripe webhook event. Settlement is injected so the
 * webhook route wires the real hot-wallet settler while tests use a stub.
 * Duplicate `invoice.paid` deliveries are absorbed by the unique
 * stripe_invoice_id constraint — settlement runs at most once per invoice.
 */
export async function processStripeWebhookEvent(
  event: Stripe.Event,
  config: ProcessConfig,
): Promise<ProcessStripeWebhookEventResult> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(event.data.object, config);
    case 'invoice.paid':
      return handleInvoicePaid(event.data.object, config);
    case 'invoice.payment_failed': {
      const row = await resolveSubscriptionRow(event.data.object, config);
      if (!row) {
        return {
          handled: false,
          detail: 'no space subscription found for failed invoice',
        };
      }
      await updateSpaceSubscription({ id: row.id, status: 'past_due' }, config);
      return {
        handled: true,
        detail: `subscription ${row.id} marked past_due`,
      };
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return handleSubscriptionChanged(event.data.object, config);
    default:
      return { handled: false, detail: `ignored event type ${event.type}` };
  }
}
