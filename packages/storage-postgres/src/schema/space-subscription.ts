import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

export const SPACE_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'active',
  'past_due',
  'canceled',
] as const;
export type SpaceSubscriptionStatus =
  (typeof SPACE_SUBSCRIPTION_STATUSES)[number];

export const SETTLEMENT_STATUSES = ['pending', 'settled', 'failed'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const spaceSubscriptions = pgTable(
  'space_subscriptions',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: text('status')
      .$type<SpaceSubscriptionStatus>()
      .notNull()
      .default('incomplete'),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_subscriptions_stripe_subscription_id_unique').on(
      table.stripeSubscriptionId,
    ),
  ],
);

export const spaceSubscriptionInvoices = pgTable(
  'space_subscription_invoices',
  {
    id: serial('id').primaryKey(),
    spaceSubscriptionId: integer('space_subscription_id')
      .notNull()
      .references(() => spaceSubscriptions.id),
    stripeInvoiceId: text('stripe_invoice_id').notNull(),
    /** USDC settlement amount in 6-decimal base units (e.g. 11 USDC = 11000000). */
    amountUsdc: text('amount_usdc').notNull(),
    settlementStatus: text('settlement_status')
      .$type<SettlementStatus>()
      .notNull()
      .default('pending'),
    settlementError: text('settlement_error'),
    txHash: text('tx_hash'),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('space_subscription_invoices_stripe_invoice_id_unique').on(
      table.stripeInvoiceId,
    ),
  ],
);

export type SpaceSubscription = InferSelectModel<typeof spaceSubscriptions>;
export type NewSpaceSubscription = InferInsertModel<typeof spaceSubscriptions>;
export type SpaceSubscriptionInvoice = InferSelectModel<
  typeof spaceSubscriptionInvoices
>;
export type NewSpaceSubscriptionInvoice = InferInsertModel<
  typeof spaceSubscriptionInvoices
>;
