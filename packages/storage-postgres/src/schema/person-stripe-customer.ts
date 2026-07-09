import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { people } from './people';

/**
 * One Stripe Customer per person, shared by all of their space
 * subscriptions so the Stripe Billing Portal lists every subscription
 * in one place.
 */
export const personStripeCustomers = pgTable(
  'person_stripe_customers',
  {
    id: serial('id').primaryKey(),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('person_stripe_customers_person_id_unique').on(table.personId),
    uniqueIndex('person_stripe_customers_stripe_customer_id_unique').on(
      table.stripeCustomerId,
    ),
  ],
);

export type PersonStripeCustomer = InferSelectModel<
  typeof personStripeCustomers
>;
export type NewPersonStripeCustomer = InferInsertModel<
  typeof personStripeCustomers
>;
