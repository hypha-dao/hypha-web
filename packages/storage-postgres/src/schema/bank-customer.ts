import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

/** Hypha-side deposit currencies the owner requested (not provider PII). */
export type BankCustomerRequestedRails = string[];

/**
 * A Bridge (or future provider) customer, owned by exactly one subject: either a
 * space (space treasury banking) or a person (individual/profile banking). The
 * DB-level XOR check guarantees exactly one owner per row.
 */
export const bankCustomers = pgTable(
  'bank_customers',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id').references(() => spaces.id),
    personId: integer('person_id').references(() => people.id),
    entityType: text('entity_type').notNull(),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    providerKycLinkId: text('provider_kyc_link_id').notNull(),
    requestedRails: jsonb('requested_rails')
      .$type<BankCustomerRequestedRails>()
      .notNull()
      .default([]),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('bank_customers_space_provider_unique').on(
      table.spaceId,
      table.provider,
    ),
    uniqueIndex('bank_customers_person_provider_unique').on(
      table.personId,
      table.provider,
    ),
    check(
      'bank_customers_owner_xor',
      sql`(${table.spaceId} IS NOT NULL) <> (${table.personId} IS NOT NULL)`,
    ),
  ],
);

export type BankCustomer = InferSelectModel<typeof bankCustomers>;
export type NewBankCustomer = InferInsertModel<typeof bankCustomers>;
