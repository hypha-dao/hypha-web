import { and, eq } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import {
  personStripeCustomers,
  spaceSubscriptionInvoices,
  spaceSubscriptions,
  type PersonStripeCustomer,
  type SettlementStatus,
  type SpaceSubscription,
  type SpaceSubscriptionInvoice,
  type SpaceSubscriptionStatus,
} from '@hypha-platform/storage-postgres';

export type InsertPersonStripeCustomerInput = {
  personId: number;
  stripeCustomerId: string;
};

/**
 * Idempotent insert keyed on person_id. Returns null when the person already
 * has a Stripe customer (e.g. a concurrent checkout won the race) — the
 * caller must re-read and use the existing one.
 */
export const insertPersonStripeCustomerIfNew = async (
  input: InsertPersonStripeCustomerInput,
  { db }: DbConfig,
): Promise<PersonStripeCustomer | null> => {
  const [row] = await db
    .insert(personStripeCustomers)
    .values(input)
    .onConflictDoNothing({ target: personStripeCustomers.personId })
    .returning();

  return row ?? null;
};

export type InsertSpaceSubscriptionInput = {
  spaceId: number;
  personId: number;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  status?: SpaceSubscriptionStatus;
};

export const insertSpaceSubscription = async (
  input: InsertSpaceSubscriptionInput,
  { db }: DbConfig,
): Promise<SpaceSubscription> => {
  const [row] = await db.insert(spaceSubscriptions).values(input).returning();

  if (!row) {
    throw new Error('Failed to insert space subscription');
  }

  return row;
};

export type UpdateSpaceSubscriptionInput = {
  id: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
  status?: SpaceSubscriptionStatus;
};

export const updateSpaceSubscription = async (
  input: UpdateSpaceSubscriptionInput,
  { db }: DbConfig,
): Promise<SpaceSubscription> => {
  const patch: Partial<typeof spaceSubscriptions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.stripeCustomerId !== undefined) {
    patch.stripeCustomerId = input.stripeCustomerId;
  }
  if (input.stripeSubscriptionId !== undefined) {
    patch.stripeSubscriptionId = input.stripeSubscriptionId;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }

  const [row] = await db
    .update(spaceSubscriptions)
    .set(patch)
    .where(eq(spaceSubscriptions.id, input.id))
    .returning();

  if (!row) {
    throw new Error('Failed to update space subscription');
  }

  return row;
};

export type InsertSubscriptionInvoiceInput = {
  spaceSubscriptionId: number;
  stripeInvoiceId: string;
  /** 6-decimal USDC base units, stringified. */
  amountUsdc: string;
};

/**
 * Idempotent insert keyed on the Stripe invoice id. Returns null when the
 * invoice was already recorded (i.e. a webhook retry), in which case the
 * caller must not settle again.
 */
export const insertSubscriptionInvoiceIfNew = async (
  input: InsertSubscriptionInvoiceInput,
  { db }: DbConfig,
): Promise<SpaceSubscriptionInvoice | null> => {
  const [row] = await db
    .insert(spaceSubscriptionInvoices)
    .values(input)
    .onConflictDoNothing({
      target: spaceSubscriptionInvoices.stripeInvoiceId,
    })
    .returning();

  return row ?? null;
};

/**
 * Atomically claims a failed invoice for a settlement retry by flipping it
 * back to `pending`. Returns null when the invoice is not in `failed` state
 * (already settled, or another delivery claimed it first) — the caller must
 * not settle in that case.
 */
export const claimFailedInvoiceForRetry = async (
  { id }: { id: number },
  { db }: DbConfig,
): Promise<SpaceSubscriptionInvoice | null> => {
  const [row] = await db
    .update(spaceSubscriptionInvoices)
    .set({
      settlementStatus: 'pending',
      settlementError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(spaceSubscriptionInvoices.id, id),
        eq(spaceSubscriptionInvoices.settlementStatus, 'failed'),
      ),
    )
    .returning();

  return row ?? null;
};

export type UpdateSubscriptionInvoiceSettlementInput = {
  id: number;
  settlementStatus: SettlementStatus;
  txHash?: string | null;
  settlementError?: string | null;
};

export const updateSubscriptionInvoiceSettlement = async (
  input: UpdateSubscriptionInvoiceSettlementInput,
  { db }: DbConfig,
): Promise<SpaceSubscriptionInvoice> => {
  const [row] = await db
    .update(spaceSubscriptionInvoices)
    .set({
      settlementStatus: input.settlementStatus,
      txHash: input.txHash ?? null,
      settlementError: input.settlementError ?? null,
      updatedAt: new Date(),
    })
    .where(eq(spaceSubscriptionInvoices.id, input.id))
    .returning();

  if (!row) {
    throw new Error('Failed to update subscription invoice settlement');
  }

  return row;
};
