import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Importing the real package would eagerly open a DB connection.
vi.mock('@hypha-platform/storage-postgres', () => ({
  spaces: { id: {}, web3SpaceId: {} },
}));

import type Stripe from 'stripe';

import { processStripeWebhookEvent } from '../process-stripe-webhook-event';
import { SUBSCRIPTION_USDC_PER_CYCLE } from '../../constants';

const findSpaceSubscriptionByStripeSubscriptionId = vi.fn();
const findSpaceSubscriptionByStripeCustomerId = vi.fn();

vi.mock('../queries', () => ({
  findSpaceSubscriptionByStripeSubscriptionId: (...args: unknown[]) =>
    findSpaceSubscriptionByStripeSubscriptionId(...args),
  findSpaceSubscriptionByStripeCustomerId: (...args: unknown[]) =>
    findSpaceSubscriptionByStripeCustomerId(...args),
}));

const insertSubscriptionInvoiceIfNew = vi.fn();
const updateSpaceSubscription = vi.fn();
const updateSubscriptionInvoiceSettlement = vi.fn();

vi.mock('../mutations', () => ({
  insertSubscriptionInvoiceIfNew: (...args: unknown[]) =>
    insertSubscriptionInvoiceIfNew(...args),
  updateSpaceSubscription: (...args: unknown[]) =>
    updateSpaceSubscription(...args),
  updateSubscriptionInvoiceSettlement: (...args: unknown[]) =>
    updateSubscriptionInvoiceSettlement(...args),
}));

const subscriptionRow = {
  id: 7,
  spaceId: 3,
  personId: 5,
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  status: 'active',
};

/** Fake drizzle chain for the direct spaces lookup in handleInvoicePaid. */
function makeDb(web3SpaceId: number | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ web3SpaceId }],
        }),
      }),
    }),
  } as never;
}

function invoicePaidEvent(): Stripe.Event {
  return {
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_1',
        customer: 'cus_1',
        parent: {
          subscription_details: { subscription: 'sub_1' },
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe('processStripeWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSpaceSubscriptionByStripeSubscriptionId.mockResolvedValue(
      subscriptionRow,
    );
    updateSpaceSubscription.mockResolvedValue(subscriptionRow);
    insertSubscriptionInvoiceIfNew.mockResolvedValue({ id: 11 });
    updateSubscriptionInvoiceSettlement.mockResolvedValue({ id: 11 });
  });

  it('settles a new paid invoice on-chain and records the tx hash', async () => {
    const settle = vi
      .fn()
      .mockResolvedValue({ ok: true, txHash: '0xabc' as const });

    const result = await processStripeWebhookEvent(invoicePaidEvent(), {
      db: makeDb(42),
      settleSpaceSubscription: settle,
    });

    expect(result.handled).toBe(true);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith({
      web3SpaceId: 42,
      amountUsdc: SUBSCRIPTION_USDC_PER_CYCLE,
    });
    expect(updateSubscriptionInvoiceSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ settlementStatus: 'settled', txHash: '0xabc' }),
      expect.anything(),
    );
  });

  it('does not settle again when the invoice was already recorded', async () => {
    insertSubscriptionInvoiceIfNew.mockResolvedValue(null);
    const settle = vi.fn();

    const result = await processStripeWebhookEvent(invoicePaidEvent(), {
      db: makeDb(42),
      settleSpaceSubscription: settle,
    });

    expect(result.handled).toBe(true);
    expect(result.detail).toContain('already recorded');
    expect(settle).not.toHaveBeenCalled();
    expect(updateSubscriptionInvoiceSettlement).not.toHaveBeenCalled();
  });

  it('marks the invoice failed when on-chain settlement fails', async () => {
    const settle = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'insufficient USDC' });

    const result = await processStripeWebhookEvent(invoicePaidEvent(), {
      db: makeDb(42),
      settleSpaceSubscription: settle,
    });

    expect(result.handled).toBe(true);
    expect(updateSubscriptionInvoiceSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        settlementStatus: 'failed',
        settlementError: 'insufficient USDC',
      }),
      expect.anything(),
    );
  });

  it('marks the invoice failed when the space has no web3SpaceId', async () => {
    const settle = vi.fn();

    const result = await processStripeWebhookEvent(invoicePaidEvent(), {
      db: makeDb(null),
      settleSpaceSubscription: settle,
    });

    expect(result.handled).toBe(true);
    expect(settle).not.toHaveBeenCalled();
    expect(updateSubscriptionInvoiceSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ settlementStatus: 'failed' }),
      expect.anything(),
    );
  });

  it('links the Stripe subscription on checkout.session.completed', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          subscription: 'sub_1',
          metadata: { spaceSubscriptionId: '7' },
        },
      },
    } as unknown as Stripe.Event;

    const result = await processStripeWebhookEvent(event, {
      db: makeDb(42),
      settleSpaceSubscription: vi.fn(),
    });

    expect(result.handled).toBe(true);
    expect(updateSpaceSubscription).toHaveBeenCalledWith(
      { id: 7, stripeSubscriptionId: 'sub_1' },
      expect.anything(),
    );
  });

  it('marks the subscription canceled on customer.subscription.deleted', async () => {
    const event = {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', status: 'canceled' } },
    } as unknown as Stripe.Event;

    const result = await processStripeWebhookEvent(event, {
      db: makeDb(42),
      settleSpaceSubscription: vi.fn(),
    });

    expect(result.handled).toBe(true);
    expect(updateSpaceSubscription).toHaveBeenCalledWith(
      { id: 7, status: 'canceled' },
      expect.anything(),
    );
  });

  it('ignores unrelated event types', async () => {
    const event = {
      type: 'payment_intent.succeeded',
      data: { object: {} },
    } as unknown as Stripe.Event;

    const result = await processStripeWebhookEvent(event, {
      db: makeDb(42),
      settleSpaceSubscription: vi.fn(),
    });

    expect(result.handled).toBe(false);
  });
});
