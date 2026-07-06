import { and, desc, eq } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import {
  spaceSubscriptionInvoices,
  spaceSubscriptions,
  type SpaceSubscription,
  type SpaceSubscriptionInvoice,
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

export const findSpaceSubscriptionByStripeCustomerId = async (
  { stripeCustomerId }: { stripeCustomerId: string },
  { db }: DbConfig,
): Promise<SpaceSubscription | null> => {
  const [row] = await db
    .select()
    .from(spaceSubscriptions)
    .where(eq(spaceSubscriptions.stripeCustomerId, stripeCustomerId))
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
