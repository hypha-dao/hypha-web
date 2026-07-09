import { and, desc, eq, isNull } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import {
  personStripeCustomers,
  spaceSubscriptionInvoices,
  spaceSubscriptions,
  spaces,
  type PersonStripeCustomer,
  type SpaceSubscription,
  type SpaceSubscriptionInvoice,
  type SpaceSubscriptionStatus,
} from '@hypha-platform/storage-postgres';

export const findSpaceSubscriptionsBySpaceId = async (
  { spaceId }: { spaceId: number },
  { db }: DbConfig,
): Promise<SpaceSubscription[]> => {
  return db
    .select()
    .from(spaceSubscriptions)
    .where(eq(spaceSubscriptions.spaceId, spaceId))
    .orderBy(desc(spaceSubscriptions.createdAt));
};

export const findSpaceSubscriptionBySpaceAndPerson = async (
  { spaceId, personId }: { spaceId: number; personId: number },
  { db }: DbConfig,
): Promise<SpaceSubscription | null> => {
  const [row] = await db
    .select()
    .from(spaceSubscriptions)
    .where(
      and(
        eq(spaceSubscriptions.spaceId, spaceId),
        eq(spaceSubscriptions.personId, personId),
      ),
    )
    .limit(1);

  return row ?? null;
};

export type PersonSpaceSubscription = {
  id: number;
  status: SpaceSubscriptionStatus;
  createdAt: Date;
  spaceSlug: string;
  spaceTitle: string;
};

export const findSpaceSubscriptionsByPersonId = async (
  { personId }: { personId: number },
  { db }: DbConfig,
): Promise<PersonSpaceSubscription[]> => {
  return db
    .select({
      id: spaceSubscriptions.id,
      status: spaceSubscriptions.status,
      createdAt: spaceSubscriptions.createdAt,
      spaceSlug: spaces.slug,
      spaceTitle: spaces.title,
    })
    .from(spaceSubscriptions)
    .innerJoin(spaces, eq(spaceSubscriptions.spaceId, spaces.id))
    .where(eq(spaceSubscriptions.personId, personId))
    .orderBy(desc(spaceSubscriptions.createdAt));
};

export const findLatestSpaceSubscriptionByPersonId = async (
  { personId }: { personId: number },
  { db }: DbConfig,
): Promise<SpaceSubscription | null> => {
  const [row] = await db
    .select()
    .from(spaceSubscriptions)
    .where(eq(spaceSubscriptions.personId, personId))
    .orderBy(desc(spaceSubscriptions.createdAt))
    .limit(1);

  return row ?? null;
};

export const findSpaceSubscriptionById = async (
  { id }: { id: number },
  { db }: DbConfig,
): Promise<SpaceSubscription | null> => {
  const [row] = await db
    .select()
    .from(spaceSubscriptions)
    .where(eq(spaceSubscriptions.id, id))
    .limit(1);

  return row ?? null;
};

export const findSpaceSubscriptionByStripeSubscriptionId = async (
  { stripeSubscriptionId }: { stripeSubscriptionId: string },
  { db }: DbConfig,
): Promise<SpaceSubscription | null> => {
  const [row] = await db
    .select()
    .from(spaceSubscriptions)
    .where(eq(spaceSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  return row ?? null;
};

/**
 * The Stripe Customer is shared by all of a person's subscriptions, so a
 * bare customer lookup is ambiguous. This resolves the row a fresh checkout
 * is paying for: the newest one not yet linked to a Stripe subscription.
 */
export const findUnlinkedSpaceSubscriptionByStripeCustomerId = async (
  { stripeCustomerId }: { stripeCustomerId: string },
  { db }: DbConfig,
): Promise<SpaceSubscription | null> => {
  const [row] = await db
    .select()
    .from(spaceSubscriptions)
    .where(
      and(
        eq(spaceSubscriptions.stripeCustomerId, stripeCustomerId),
        isNull(spaceSubscriptions.stripeSubscriptionId),
      ),
    )
    .orderBy(desc(spaceSubscriptions.createdAt))
    .limit(1);

  return row ?? null;
};

export const findPersonStripeCustomerByPersonId = async (
  { personId }: { personId: number },
  { db }: DbConfig,
): Promise<PersonStripeCustomer | null> => {
  const [row] = await db
    .select()
    .from(personStripeCustomers)
    .where(eq(personStripeCustomers.personId, personId))
    .limit(1);

  return row ?? null;
};

export const findSubscriptionInvoiceByStripeInvoiceId = async (
  { stripeInvoiceId }: { stripeInvoiceId: string },
  { db }: DbConfig,
): Promise<SpaceSubscriptionInvoice | null> => {
  const [row] = await db
    .select()
    .from(spaceSubscriptionInvoices)
    .where(eq(spaceSubscriptionInvoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);

  return row ?? null;
};
